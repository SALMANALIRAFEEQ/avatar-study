# Analysis Plan (pre specified, Phase 1b)

Written before data collection. Any change after seeing data must be reported as a change in the write up.

## No AI in the analysis

The evaluation is a deterministic Python script. No LLM summarizes or interprets the numbers. Reasons: results must be reproducible, checkable and defensible to a professor. Free text answers are exported for Salman to read and code by hand (with about 30 to 40 short answers this takes under an hour).

## 1. Load and validate

- Read `participants.csv` and `responses.csv`.
- Check required columns exist and values are in range (Likert 1 to 7, Godspeed 1 to 5). Stop with a clear error listing problems.
- Drop `is_test = true` rows first; report count.

## 2. Exclusions

Apply the six rules in STUDY_DESIGN.md in order. Write `exclusions.csv` (participant_id, rule). Report N before and after, and per rule.

## 3. Scale scores

For each participant × video: mean of items per scale: TR (5), NAT (5), LIK (5), ENG (3), PI (3). MC items analyzed separately.

## 4. Reliability

Cronbach's alpha per scale, computed separately for each condition. Flag any alpha below .70 in the report (with this N, alpha is unstable; report it, don't over interpret).

## 5. Descriptives

Per condition: mean, SD, median, n for each scale and each MC item. Demographic counts.

## 6. Tests (main)

For each outcome (MC_warm, MC_expressive, TR, NAT, LIK, ENG, PI): warm vs neutral, within subjects.

- **Paired t test** (two sided).
- **Wilcoxon signed rank** as a robustness check (Likert data, small N).
- **Effect size:** Cohen's d_z with 95% CI (bootstrap, 5000 resamples, seed 42), plus the mean difference with 95% CI.
- Report p values but lead with effect sizes. No correction for multiple comparisons in the pilot; state this and treat everything except the manipulation check as exploratory.

Manipulation check counts as successful if MC_warm is higher for warm with d_z CI excluding 0. If it fails, say so plainly: the other results then can't be interpreted as effects of warmth.

## 7. Order and carryover checks

- Linear mixed model per outcome (statsmodels MixedLM): `score ~ condition + position + (1 | participant)`. Report the condition coefficient and whether position effects are large. (Changed 2026-10-13: the product term was removed because only one product was produced; see STUDY_DESIGN.md.)
- Between subjects on first video only: Welch t test warm vs neutral, with d and CI. Expect wide CIs; this is a carryover sanity check.

## 8. Forced choices

CMP_trust and CMP_buy mapped to condition (warm / neutral / none). Report counts and percentages. Binomial test of warm vs neutral among those who chose (excluding "no difference").

## 9. Behaviour

Watch time and replays by condition (descriptives only). Rating block completion time by condition.

## 10. Figures (PNG, 150 dpi, plain style, colorblind safe)

1. Paired dot plot per main outcome: each participant's two scores connected by a line, condition means with 95% CI.
2. Bar chart of forced choice counts.
3. Mean difference (warm minus neutral) with 95% CI for all outcomes on one forest style plot. This is the headline figure.

## 11. Report

`report.html` sections: Overview (pilot, N, design), Exclusions, Manipulation check, Main results table (mean per condition, difference, CI, d_z, p, Wilcoxon p), Figures, Order checks, Forced choice, Reliability, Behaviour, Limitations (small convenience sample, one product shown twice (participants likely notice the style difference), known differences between the two videos (see STUDY_DESIGN.md, "As produced"), AI disclosure, single avatar, no correction for multiple tests), Next steps for the full study (sample size estimate from observed d_z for 80% power, using a standard power calculation).

Wording rules: say "in this pilot", "suggests", "estimated"; never "proves". Do not call a result significant without also giving the effect size and CI.
