# Company search result schema

Write UTF-8 JSON using this shape:

```json
{
  "schema_version": 1,
  "request_id": "copy from the task file",
  "searched_at": "2026-08-29T08:00:00.000Z",
  "notes": "optional run-level note",
  "companies": [
    {
      "name": "企业名称",
      "city": "目标城市",
      "role": "与任务匹配的岗位方向；不确定时写待确认",
      "recruitment_type": "校招、社招、实习或待确认",
      "official_url": "https://official-careers.example/jobs",
      "source_url": "https://public-page-used-for-verification.example",
      "access": "public",
      "notes": "说明城市、招聘批次、发布日期和仍需用户核验的部分"
    }
  ]
}
```

Required per-company fields: `name`, `official_url`, and `access`.

Allowed `access` values:

- `public`: the recruitment page is publicly viewable.
- `login_required`: an account or sign-in is required.
- `verification_required`: CAPTCHA, anti-bot, or another verification step blocks access.
- `unknown`: access or official ownership could not be fully confirmed.

Use the official recruitment entry in `official_url`, never a search-engine result URL. `source_url` may equal `official_url` when the official page itself is the verification source.
