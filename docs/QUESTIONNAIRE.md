# Questionnaire

Source of truth for every item. The config file is built from this. Item IDs are used as data column names, so never rename an ID once data collection starts.

Scale wording and anchors below are what participants see. "Adapted" means the construct and structure follow the cited instrument; wording is ours and should be checked against the original paper before the final write up.

## Block DEMO: About you (once, before videos)

Shown over three pages, in this order. Items are not shuffled.

Changed 2026-10-13 at Salman's request (app_version 1a.1.0): added DEMO_english, DEMO_education, DEMO_occupation (with write-in DEMO_occupation_other), DEMO_social_media and DEMO_ai_tools, and split the block over three pages.

**Page 1: A few details about you**

| ID | Question | Response |
|---|---|---|
| DEMO_age | Your age | 18 to 24 / 25 to 34 / 35 to 44 / 45+ |
| DEMO_gender | Gender | Woman / Man / Prefer to self describe / Prefer not to say |
| DEMO_country | Country you live in | Pakistan / Other |
| DEMO_country_other | Please tell us which country | Free text, max 60 chars. Shown and required only when DEMO_country = Other; empty otherwise. Added 2026-10-13 at Salman's request (app_version 1a.2.1); rows from 1a.2.0 have no value here |
| DEMO_english | How comfortable are you understanding spoken English? | Very comfortable / Comfortable / Somewhat comfortable / Not comfortable |

**Page 2: Education and work**

| ID | Question | Response |
|---|---|---|
| DEMO_education | Highest level of education you have completed | Secondary school (Matric / O Levels) or less / Intermediate (FA / FSc / A Levels) / Bachelor's degree / Master's degree or higher / Prefer not to say |
| DEMO_occupation | What do you currently do? | Student / Employed (public / government sector) / Employed (private sector) / Self-employed / business owner / Not currently working / Other |
| DEMO_occupation_other | Please tell us what you do | Free text, max 100 chars. Shown and required only when DEMO_occupation = Other; empty otherwise |

**Page 3: Online habits**

| ID | Question | Response |
|---|---|---|
| DEMO_online_shop | How often do you buy things online? | Never / A few times a year / Monthly / Weekly or more |
| DEMO_social_media | On a typical day, how much time do you spend on social media? | Less than 1 hour / 1 to 2 hours / 2 to 4 hours / More than 4 hours |
| DEMO_ai_tools | How often do you use AI tools such as ChatGPT or Gemini? | Never / Rarely / A few times a month / Weekly / Daily |
| DEMO_ai_seen | Before today, had you seen videos with AI generated presenters? | No / Not sure / Yes, a few / Yes, often |
| DEMO_device_note | (not a question; device class recorded automatically) | |

## Rating block (shown after EACH video; same items both times)

Header shown above the block: "Think about the presenter in the video you just watched."

### MC: Manipulation check (7 point, 1 = Not at all, 7 = Extremely)

| ID | Item |
|---|---|
| MC_expressive | How emotionally expressive was the presenter? |
| MC_warm | How warm and friendly did the presenter seem? |

### TR: Trustworthiness (semantic differential, 7 point)
Adapted from Ohanian (1990), source credibility scale, trustworthiness dimension. Left label = 1, right label = 7.

| ID | Left (1) | Right (7) |
|---|---|---|
| TR_1 | Undependable | Dependable |
| TR_2 | Dishonest | Honest |
| TR_3 | Unreliable | Reliable |
| TR_4 | Insincere | Sincere |
| TR_5 | Untrustworthy | Trustworthy |

### NAT: Naturalness / anthropomorphism (semantic differential, 5 point)
Adapted from the Godspeed questionnaire, anthropomorphism scale (Bartneck et al., 2009). Godspeed uses 5 points; keep 5.

| ID | Left (1) | Right (5) |
|---|---|---|
| NAT_1 | Fake | Natural |
| NAT_2 | Machinelike | Humanlike |
| NAT_3 | Unconscious | Conscious |
| NAT_4 | Artificial | Lifelike |
| NAT_5 | Moving rigidly | Moving elegantly |

### LIK: Likeability (semantic differential, 5 point)
Adapted from the Godspeed questionnaire, likeability scale (Bartneck et al., 2009).

| ID | Left (1) | Right (5) |
|---|---|---|
| LIK_1 | Dislike | Like |
| LIK_2 | Unfriendly | Friendly |
| LIK_3 | Unkind | Kind |
| LIK_4 | Unpleasant | Pleasant |
| LIK_5 | Awful | Nice |

### ENG: Engagement with the video (7 point agreement, 1 = Strongly disagree, 7 = Strongly agree)
Custom items for the pilot.

| ID | Item |
|---|---|
| ENG_1 | The video held my attention. |
| ENG_2 | I found the video interesting. |
| ENG_3 | If I saw this video online, I would watch it to the end. |

### PI: Purchase intention (7 point agreement)
Adapted from purchase intention measures in Dodds, Monroe and Grewal (1991).

| ID | Item |
|---|---|
| PI_1 | If I needed a product like this, I would consider buying it. |
| PI_2 | The likelihood that I would buy this product is high. |
| PI_3 | I would recommend this product to a friend. |

### ATT: Attention check (only in the rating block after VIDEO 2, mixed into the ENG items)

| ID | Item | Correct answer |
|---|---|---|
| ATT_1 | To show you are reading carefully, please select "Somewhat agree" for this item. | 5 (Somewhat agree) |

7 point agreement labels: 1 Strongly disagree, 2 Disagree, 3 Somewhat disagree, 4 Neither agree nor disagree, 5 Somewhat agree, 6 Agree, 7 Strongly agree.

## Block CMP: Comparison (once, after both videos)

Show a still thumbnail of each presenter (frame from each video) labeled "Video 1" and "Video 2", in the order seen.

| ID | Question | Response |
|---|---|---|
| CMP_trust | Which presenter did you trust more? | Video 1 / Video 2 / No difference / not sure |
| CMP_buy | Which video made you more likely to buy the product? | Video 1 / Video 2 / No difference / not sure |
| CMP_why | In a sentence or two, what made the difference for you? | Free text, optional, max 500 chars |
| CMP_noticed | Did you notice any differences between the two presenters? If yes, what? | Free text, optional, max 500 chars |

The analysis maps Video 1 / Video 2 back to condition using the participant's sequence. The third option is stored as `none`. Its label became "No difference / not sure" on 2026-10-13 (stored value unchanged), so it also covers people who can't tell.

Rating scales have no "don't know" option on purpose: each has a neutral midpoint, and a "don't know" would create missing values in the paired comparison.

## Instruction shown above each video

Added 2026-10-13 at Salman's request (also as the first tip on the welcome page):

> This study is about **the presenter**, not the video's production quality. Please pay attention to how the presenter speaks and comes across.

It deliberately doesn't name tone or emotion, so participants aren't told what differs between the two videos.

## Notes for implementation

- All rating items are required (no skipping), except free text.
- Show one block per screen on desktop; on phones one block per screen with a scrollable list is fine.
- Semantic differentials: show both labels with the point buttons between them, no numbers shown to participants.
- Do not pre select any answer.
