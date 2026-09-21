

















You do not necessarily need both "ids" and "status" in the report filter. My previous example was misleading.

In Clockify's Reports API, the filter is primarily based on IDs. The report endpoint does not need to know that a user/project is "active" if you already supplied only active IDs.

The usual pattern is:

Fetch users:

GET /api/v1/workspaces/{workspaceId}/users
Keep only active users in your code:

[
  {
    "id": "64abc123",
    "status": "ACTIVE"
  }
]
Send only those IDs to the report:

{
  "detailedFilter": {
    "page": 1,
    "pageSize": 100
  },
  "users": {
    "ids": [
      "64abc123"
    ]
  }
}
Same for projects:

{
  "projects": {
    "ids": [
      "64def123"
    ]
  }
}
The "status": "ACTIVE" field belongs to the user/project object returned by the regular Clockify API, not necessarily to the Reports API filter.

So the cleaner workflow is:

Clockify API
    ↓
GET users/projects
    ↓
filter status == ACTIVE
    ↓
extract IDs
    ↓
Reports API with only those IDs
You only need "status" if you are processing the /users or /projects API response. You generally should not include it in the report request.


curl -X POST \
  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \
  -H "X-Api-Key: ___" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRangeStart": "2026-01-01T00:00:00.000Z",
    "dateRangeEnd": "2026-01-31T23:59:59.999Z","detailedFilter": {
    "page": 1,
    "pageSize": 50
  },"projects":[{"status":"ACTIVE"}]
  }'

Your request is close, but this part is the problem:

"projects":[{"status":"ACTIVE"}]
The Reports API does not accept status as a project filter. The projects filter expects project IDs (or a structure containing IDs), not the lifecycle status.

If you want only active projects, you need to:

Fetch active projects from the regular API:

curl -X GET \
"https://api.clockify.me/api/v1/workspaces/6a56be5190be884d3913429d/projects" \
-H "X-Api-Key: ___"
Filter the response locally:

{
  "id": "project123",
  "name": "My Project",
  "status": "ACTIVE"
}
Send those IDs to the report endpoint.

Your report request should look more like:

curl -X POST \
"https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \
-H "X-Api-Key: ___" \
-H "Content-Type: application/json" \
-d '{
  "dateRangeStart": "2026-01-01T00:00:00.000Z",
  "dateRangeEnd": "2026-01-31T23:59:59.999Z",
  "detailedFilter": {
    "page": 1,
    "pageSize": 50
  },
  "projects": {
    "ids": [
      "ACTIVE_PROJECT_ID_1",
      "ACTIVE_PROJECT_ID_2"
    ]
  }
}'
However, there is an additional subtlety: the exact JSON shape for projects depends on the Clockify Reports API version. In many Clockify examples, filters are nested under projectIds rather than projects.

If the above returns a validation error, try:

{
  "dateRangeStart": "2026-01-01T00:00:00.000Z",
  "dateRangeEnd": "2026-01-31T23:59:59.999Z",
  "detailedFilter": {
    "page": 1,
    "pageSize": 50
  },
  "projectIds": [
    "ACTIVE_PROJECT_ID_1",
    "ACTIVE_PROJECT_ID_2"
  ]
}
To verify the exact schema your Clockify account accepts, the quickest test is to send the request without any project filter first. If that works, add the project filter and adjust the shape based on the API error message.

Also note: since your date range is January 2026, make sure there are actually time entries in that period; otherwise the report can legitimately return empty results.


 -H "Content-Type: application/json" \
  -d '{
    "dateRangeStart": "2026-01-01T00:00:00.000Z",
    "dateRangeEnd": "2026-01-31T23:59:59.999Z",
        "detailedFilter": {
            "page": 1,
            "pageSize": 50
          },
        "projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]
        ]
  }'
{"code":400,"message":"Could not parse JSON"}%

Your JSON is invalid because you have an extra closing square bracket ] after the projectIds array.

Your payload currently ends like this:

"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]
]
The second ] does not have a matching opening [.

Use:

curl -X POST \
  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \
  -H "X-Api-Key: ___" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRangeStart": "2026-01-01T00:00:00.000Z",
    "dateRangeEnd": "2026-01-31T23:59:59.999Z",
    "detailedFilter": {
      "page": 1,
      "pageSize": 50
    },
    "projectIds": [
      "6a56beddad8f1241b2297bf0",
      "6a56c13b7d25de7ecd606e50"
    ]
  }'
If you still get an error after this, the next thing to check is whether projectIds is the correct field name for your Clockify Reports API version. A JSON parse error happens before Clockify validates fields, so this particular error is only about syntax, not the API filter.





9987  curl -X GET "https://api.clockify.me/api/v1/workspaces" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0"\n
 9988  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z"\n  }'
 9989  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z",\n  }'
 9990  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z","detailedFilter": {\n    "page": 1,\n    "pageSize": 50\n  }\n  }'
 9991  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z","detailedFilter": {\n    "page": 1,\n    "pageSize": 50\n  },"projects":[{"status":"ACTIVE"}]\n  }'
 9992  curl -X GET \\n"https://api.clockify.me/api/v1/workspaces/6a56be5190be884d3913429d/projects" \\n-H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0"
 9993  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: " \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z",\n\t"detailedFilter": {\n\t    "page": 1,\n\t    "pageSize": 50\n\t  },\n\t"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]\n\t]\n  }'
 9994  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z",\n\t"detailedFilter": {\n\t    "page": 1,\n\t    "pageSize": 50\n\t  },\n\t"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]\n\t]\n  }'
 9995  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-01-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-01-31T23:59:59.999Z",\n\t"detailedFilter": {\n\t    "page": 1,\n\t    "pageSize": 50\n\t  },\n\t"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]\n  }'
 9996  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-07-01T00:00:00.000Z",\n    "dateRangeEnd": "2026-07-31T23:59:59.999Z",\n\t"detailedFilter": {\n\t    "page": 1,\n\t    "pageSize": 50\n\t  },\n\t"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]\n  }'
 9997  \ncurl -X POST \\n  "https://reports.api.clockify.me/v1/workspaces/6a56be5190be884d3913429d/reports/detailed" \\n  -H "X-Api-Key: NTA0YjgyMDUtM2UzMS00MTUzLTkyNDQtMTk4MDQ3OTRlNmI0" \\n  -H "Content-Type: application/json" \\n  -d '{\n    "dateRangeStart": "2026-07-14T00:00:00.000Z",\n    "dateRangeEnd": "2026-07-31T23:59:59.999Z",\n\t"detailedFilter": {\n\t    "page": 1,\n\t    "pageSize": 50\n\t  },\n\t"projectIds": ["6a56beddad8f1241b2297bf0","6a56c13b7d25de7ecd606e50"]\n  }'
 9998