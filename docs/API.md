# API Documentation

Base URL: `http://localhost:3000`

## WABAs

`GET /api/wabas`

Returns connected WABAs with name, ID, status, country, template count and last sync date.

`POST /api/wabas`

Retrieves WABAs from Vonage when `VONAGE_API_KEY`, `VONAGE_API_SECRET`, `VONAGE_APPLICATION_ID` and `VONAGE_PRIVATE_KEY` are configured.

## Templates

`GET /api/templates`

Returns templates with generated names, language, category, variable mappings and status.

`POST /api/templates`

Validates one spreadsheet row and optionally submits it to Vonage.

```json
{
  "wabaId": "waba_ab_fr",
  "submit": false,
  "row": {
    "BRAND": "AB",
    "Language": "EN",
    "Template": "Sample follow up",
    "Template Name": "Following up on your sample",
    "Template Body": "Hello [FIRST NAME]",
    "Template Type": "MARKETING"
  }
}
```

`DELETE /api/templates/{id}`

Deletes a template from PostgreSQL. Requires `DATABASE_URL`.

## Imports

`POST /api/imports/validate`

Runs mandatory-column validation, row validation, variable normalization, JSON generation and duplicate detection.

```json
{
  "targetWabaIds": ["waba_ab_fr"],
  "rows": [
    {
      "BRAND": "AB",
      "Language": "EN",
      "Template": "Sample follow up",
      "Template Name": "Following up on your sample",
      "Template Body": "Hello [FIRST NAME]",
      "Template Type": "MARKETING"
    }
  ]
}
```

`GET /api/imports/{id}`

Returns import status, counters and mode.

`POST /api/imports/retry`

Queues retry requests for `single`, `batch` or `all_failed` scopes.

## Logs

`GET /api/logs`

Returns recent import and submission logs.

## Sync

`POST /api/sync/templates`

Accepts a list of WABA IDs and queues a template sync job.
