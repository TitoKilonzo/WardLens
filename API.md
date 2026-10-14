# WardLens API reference

Base path: `/api`. JSON is used for request and response bodies. Protected routes use `Authorization: Bearer <token>` from the login/register response.

## Health and authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API status |
| POST | `/auth/register` | Public | Create resident account (`name`, `email`, `password`, `ward_id`) |
| POST | `/auth/login` | Public | Authenticate (`email`, `password`) |
| GET | `/auth/me` | Authenticated | Current account |
| POST | `/auth/logout` | Authenticated | Record logout; client clears token |
| POST | `/contact` | Public | Persist a contact message (`name`, `email`, `topic`, `message`) |

## Public project discovery

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/projects` | Public | List projects; optional `search`, `status`, `category`, `ward` query parameters |
| GET | `/projects/:id` | Public | Project, milestones, financial records and feedback |
| POST | `/projects` | Resident | Submit proposal (`title`, `description`, `category`, `ward_id`, `estimated_cost`, `location`, optional `image_url`) |
| POST | `/projects/:id/vote` | Resident | Support proposal once per account |
| DELETE | `/projects/:id/vote` | Resident | Withdraw own support |
| POST | `/projects/:id/feedback` | Resident | Add feedback (`message`) |
| GET | `/wards` | Public | List wards and aggregate summaries |
| GET | `/wards/:slug` | Public | Ward details and its projects |
| GET | `/budgets` | Public | Financial records; optional `ward` and `kind` filters |
| GET | `/dashboard` | Authenticated | Current resident's proposals, votes, and feedback |

## Management and oversight

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/admin/stats` | Officer, oversight, admin | Summary metrics |
| GET | `/admin/projects` | Officer, oversight, admin | Project review queue; optional `status` |
| PATCH | `/admin/projects/:id/status` | Officer, admin | Change project status with a decision note |
| POST | `/admin/projects/:id/milestones` | Officer, admin | Publish milestone |
| PATCH | `/admin/milestones/:id` | Officer, admin | Update milestone status/evidence URL |
| POST | `/admin/projects/:id/budget-records` | Officer, oversight, admin | Add allocation, expenditure, or adjustment |
| GET | `/admin/feedback` | Officer, oversight, admin | List community feedback |
| PATCH | `/admin/feedback/:id` | Officer, admin | Update feedback state and official response |
| GET | `/admin/contact-messages` | Officer, oversight, admin | List contact messages |
| PATCH | `/admin/contact-messages/:id` | Officer, admin | Respond to contact message |
| GET | `/admin/audit-logs` | Oversight, admin | Read latest 100 audit entries |

## Common errors

- `400` — request validation failed.
- `401` — missing, invalid, or expired token.
- `403` — signed-in role lacks permission.
- `404` — resource was not found.
- `409` — email already exists or the resident has already voted for the proposal.

The API returns errors as `{ "error": "Human-readable explanation" }` and successful mutations usually return a `message` plus the created/updated resource where useful.
