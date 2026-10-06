# Hisab Flow V20 — Universal Semantic Prompting

## Problem fixed
The production semantic prompt previously injected a large few-shot corpus containing repeated concrete names such as Ramesh, Arjun and Jinal. Although those names were intended as examples, a language model can over-index on them. That is the opposite of a universal voice assistant.

## Fix
- Regression/GOD datasets remain in the repository for testing and future evaluation.
- Production prompt examples are now semantic templates using runtime slots such as `<customer>`, `<product>`, `<supplier>`, `<amount>`, `<quantity>` and `<date>`.
- The prompt explicitly states that slots are arbitrary runtime values and that current explicit entities outrank examples and stale context.
- No production few-shot example tells the model that a particular person's name should map to a particular customer.

## Result
The same semantic behavior is intended to work for any customer, product, supplier or location, not only the names used in test conversations.

## Important
This is semantic prompt/few-shot engineering, not model-weight fine-tuning. The deterministic accounting engine remains the source of truth and still performs entity resolution and database mutations.
