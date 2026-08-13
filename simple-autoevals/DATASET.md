# Invoice Image 50

This local dataset pack contains 50 annotated synthetic invoice images for the first `simple-autoevals` experiment.

## Source

- Original: [High-Quality Invoice Images for OCR](https://www.kaggle.com/datasets/osamahosamabdellatif/high-quality-invoice-images-for-ocr)
- Selective mirror: [Voxel51/high-quality-invoice-images-for-ocr](https://huggingface.co/datasets/Voxel51/high-quality-invoice-images-for-ocr)
- Mirror revision: `d21f03cfeea2b330e15a229883c66d7ebece8e69`
- License shown by the mirror: ODbL-1.0

The source contains synthetic English invoices. Only records with structured annotations are eligible. The prepared cases retain four ground-truth fields: invoice number, invoice date, seller name, and total.

## Selection

The script selects 50 cases deterministically from every annotated record available at the pinned mirror revision:

- 45 cases with the lowest SHA-256 ranks derived from a fixed seed and source ID;
- minimum and maximum total;
- longest seller name;
- earliest and latest invoice date.

Cases are ordered by source ID after selection. The manifest records source URLs, image checksums, dimensions, expected fields, tags, selection method, and dataset revision.

The pinned mirror contains one byte-and-label-identical duplicate annotated record. Preparation removes that duplicate by source ID and records both the raw annotated-record count and unique-candidate count. A conflicting duplicate would stop preparation.

## Prepare

Use the already downloaded metadata file when available:

```bash
node prepare-data.mjs --metadata /tmp/invoice-samples.json --count 50
```

Or let the script download the pinned metadata itself:

```bash
node prepare-data.mjs --count 50
```

Generated files:

```text
data/invoice-50/
├── manifest.json
└── images/
    └── 50 JPEG files
```

The manifest is intended to be reviewed and versioned. Images remain ignored locally to avoid committing downloaded dataset assets.

## Verify

```bash
node --test test/prepare-data.test.mjs
```

After preparation, verify that the manifest contains 50 unique cases and that every referenced image matches its recorded SHA-256 checksum. The preparation script rejects missing annotations, malformed labels, invalid dates or totals, duplicate source IDs, non-JPEG downloads, and byte-size mismatches.

## Limitations

- The invoices are synthetic, English-only, and visually similar.
- Fifty cases are useful for a small experiment, not a general model-quality claim.
- Labels come from the dataset's generation/annotation pipeline and still warrant spot checking.
- Confirm the original Kaggle license terms before redistributing images outside this local experiment.
