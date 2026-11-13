import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

export function makePerfPdf() {
  let seed = 0x5eed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const objects = [];
  const add = (value) => objects.push(Buffer.from(value));
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(
    `<< /Type /Pages /Count 40 /Kids [${Array.from({ length: 40 }, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] >>`,
  );
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let page = 1; page <= 40; page++) {
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + (page - 1) * 2} 0 R >>`,
    );
    const commands = ['0.35 w'];
    const coordinate = (extent) => (20 + random() * extent).toFixed(0);
    const colours = Array.from({ length: 12 }, () =>
      Array.from({ length: 3 }, () => (0.25 + random() * 0.65).toFixed(3)).join(
        ' ',
      ),
    );
    for (let i = 0; i < 6000; i++) {
      const x = Number(coordinate(535));
      const y = Number(coordinate(782));
      const point = () =>
        `${(x + random() * 16).toFixed(0)} ${(y + random() * 16).toFixed(0)}`;
      const fill = i % 2 === 0;
      commands.push(
        `${colours[i % 12]} ${fill ? 'rg' : 'RG'} ${x} ${y} m ${point()} ${point()} ${point()} c ${fill ? 'f' : 'S'}`,
      );
    }
    commands.push('0 g', 'BT /F1 9 Tf 12 TL 30 810 Td');
    for (let line = 1; line <= 45; line++) {
      commands.push(
        `(Page ${page}, line ${line}: Deterministic curves and text for the scrolling probe.) Tj T*`,
      );
    }
    commands.push('ET');
    const stream = deflateSync(Buffer.from(commands.join('\n')), { level: 9 });
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`,
        ),
        stream,
        Buffer.from('\nendstream'),
      ]),
    );
  }
  const chunks = [Buffer.from('%PDF-1.7\n')];
  const offsets = [0];
  let size = chunks[0].length;
  for (const [i, object] of objects.entries()) {
    offsets.push(size);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(chunk);
    size += chunk.length;
  }
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
        .join(
          '',
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`,
    ),
  );
  const pdf = Buffer.concat(chunks);
  if (pdf.length >= 5_000_000)
    throw new Error(`Generated PDF exceeds 5 MB: ${pdf.length}`);
  return pdf;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const target = resolve(process.argv[2] ?? '.work/perf/perf-40pages.pdf');
  const pdf = makePerfPdf();
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, pdf);
  console.log(
    `${pdf.length} bytes; sha256 ${createHash('sha256').update(pdf).digest('hex')}`,
  );
}
