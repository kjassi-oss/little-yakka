# Little Yakka — schema snapshot

Auto-generated from the live PostgREST OpenAPI spec (DR reference; not a full pg_dump — no functions/triggers/RLS bodies). Regenerate: scratchpad/schema-snapshot.

## families

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| name | text |  |
| settings | jsonb |  |
| created_at | timestamp with time zone |  |
| bonus_cadence | text |  |
| bonus_day | integer |  |
| bonus_time | text |  |
| bonus_award_pct | integer |  |

## guardian_invitations

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| invited_email | text |  |
| token | uuid |  |
| used | boolean |  |
| created_at | timestamp with time zone |  |

## push_subscriptions

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| endpoint | text |  |
| p256dh | text |  |
| auth | text |  |
| created_at | timestamp with time zone |  |
| platform | text |  |

## task_assignments

| column | type | notes |
|---|---|---|
| task_id | uuid | Note: This is a Primary Key.<pk/> This is a Foreign Key to ` |
| child_id | uuid | Note: This is a Primary Key.<pk/> This is a Foreign Key to ` |

## spin_results

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| stars_won | integer |  |
| date | date |  |
| created_at | timestamp with time zone |  |

## children

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| name | text |  |
| avatar | text |  |
| colour | text |  |
| birthdate | date |  |
| kid_pin | text |  |
| created_at | timestamp with time zone |  |
| avatar_url | text |  |
| age | integer |  |
| goal_title | text |  |
| goal_emoji | text |  |
| goal_target | integer |  |
| equipped_hat | text |  |
| equipped_frame | text |  |

## tasks

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| title | text |  |
| emoji | text |  |
| type | text |  |
| time_of_day | text |  |
| recurrence | text |  |
| star_value | integer |  |
| requires_photo | boolean |  |
| created_at | timestamp with time zone |  |
| frequency | text |  |
| carry_over | boolean |  |
| requires_benchmark_photo | boolean |  |
| benchmark_differs_per_child | boolean |  |
| difficulty | text |  |
| requires_approval | boolean |  |
| start_date | date |  |
| days_of_week | integer[] |  |
| can_do_early | boolean |  |
| up_for_grabs | boolean |  |
| expires_on | date |  |

## child_unlocks

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| item_id | text |  |
| created_at | timestamp with time zone |  |

## rewards

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| title | text |  |
| emoji | text |  |
| star_cost | integer |  |
| scope | text |  |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| redemption_limit | integer |  |
| created_at | timestamp with time zone |  |

## task_benchmark_photos

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| task_id | uuid | Note: This is a Foreign Key to `tasks.id`.<fk table='tasks'  |
| url | text |  |
| media_type | text |  |
| sort_order | integer |  |
| created_at | timestamp with time zone |  |

## guardians

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| auth_user_id | uuid |  |
| name | text |  |
| email | text |  |
| parent_pin | text |  |
| created_at | timestamp with time zone |  |

## completions

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| task_id | uuid | Note: This is a Foreign Key to `tasks.id`.<fk table='tasks'  |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| date | date |  |
| status | text |  |
| photo_url | text |  |
| ai_verdict | text |  |
| ai_reason | text |  |
| approved_by | uuid | Note: This is a Foreign Key to `guardians.id`.<fk table='gua |
| created_at | timestamp with time zone |  |

## completion_photos

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| completion_id | uuid | Note: This is a Foreign Key to `completions.id`.<fk table='c |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| url | text |  |
| created_at | timestamp with time zone |  |

## star_ledger

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| delta | integer |  |
| reason | text |  |
| source_type | text |  |
| source_id | uuid |  |
| created_at | timestamp with time zone |  |

## redemptions

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| reward_id | uuid | Note: This is a Foreign Key to `rewards.id`.<fk table='rewar |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| date | date |  |
| status | text |  |
| created_at | timestamp with time zone |  |

## family_goals

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| family_id | uuid | Note: This is a Foreign Key to `families.id`.<fk table='fami |
| title | text |  |
| target | integer |  |
| progress | integer |  |
| reward_text | text |  |
| created_at | timestamp with time zone |  |

## praises

| column | type | notes |
|---|---|---|
| id | uuid | Note: This is a Primary Key.<pk/> |
| child_id | uuid | Note: This is a Foreign Key to `children.id`.<fk table='chil |
| message | text |  |
| seen | boolean |  |
| created_at | timestamp with time zone |  |

