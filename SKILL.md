---
name: job-secretary-company-search
description: Find and verify official company recruitment websites from a 求职秘书 AI search task JSON, then return an importable result file. Use for company lead finding only, not login, form submission, or automatic applications.
---

# 求职秘书企业搜索

Read the `求职秘书-AI搜索任务-*.json` file supplied by the user. Use its `criteria` as the source of truth for province, city, role direction, and recruitment type.

## Search outcome

Find distinct companies that plausibly match the requested city and role direction, then return their official recruitment entry points in `company-search-results.json` beside the task file unless the user chooses another output folder.

Use your own web-search capability. Search broadly enough to discover companies, but verify each result before including it:

- Prefer the company's official recruitment site, official campus-recruitment site, or an ATS page linked from the company's official domain.
- Confirm the result is associated with the requested city. A generic careers homepage alone is not evidence that the city currently has an opening; state uncertainty in `notes`.
- Preserve the public page used to verify the result in `source_url`.
- Mark directly viewable pages as `public`.
- Mark account-gated pages as `login_required`; mark CAPTCHA, anti-bot, or other verification pages as `verification_required`, and stop interacting with them.
- Exclude search-result pages, BOSS直聘, 实习僧, scraped reposts, and unverified aggregators from `official_url`.
- Do not guess that a role is open, fabricate a posting, log in, bypass controls, upload a résumé, or submit an application.

Deduplicate by normalized official recruitment URL and company name. Prefer a direct city/role listing over a generic careers homepage when both are officially verifiable.

## Result format

Read [references/company-search-result-schema.md](references/company-search-result-schema.md) before writing results. Return only schema-compatible JSON in the output file. Do not place commentary before or after the JSON.

If no company can be verified, still create a valid result file with an empty `companies` array and explain the search limitations in top-level `notes`.
