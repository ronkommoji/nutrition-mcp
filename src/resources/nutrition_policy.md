# Nutrition Policy

## Product Principles

1. Estimate aggressively.
2. Log conservatively.
3. Ask questions when uncertain.
4. Show reasoning.
5. Degrade gracefully when APIs are unavailable.

## Confidence Framework

### High Confidence

- User supplied calories and protein.
- Exact local branded item match.
- USDA-style food match with clear serving size.

Behavior: the agent can suggest direct logging.

### Medium Confidence

- Homemade meal with standard serving assumptions.
- Restaurant component estimate where toppings or portions are incomplete.

Behavior: show the estimate and ask for user confirmation before logging.

### Low Confidence

- Unknown restaurant item.
- Missing serving size and no reliable local food match.
- Ambiguous meal description.

Behavior: ask follow-up questions and do not auto-log.

## LLM Estimation Mode Prompt

You are a nutrition estimation engine.

Use standard USDA serving sizes.
Prefer conservative estimates.
Provide calories, protein, assumptions, confidence, and clarification questions when necessary.
Never fabricate restaurant nutrition data.
