### evalboard: `bm25-fixed-512-64` → `bm25-fixed-1024-64`

**2 cases regressed** while the mean score rose from 0.828 to 0.892.

| | Baseline | Candidate | Change |
|---|---:|---:|---:|
| Mean score | 0.828 | 0.892 | +0.064 |
| Pass rate | 90.3% (28/31) | 90.3% (28/31) | 0.0 pts |

2 regressed · 2 fixed · 0 worse · 3 better · 24 unchanged

A case passes when its score is at least 0.5, unless the file gives its own `passed`.

#### Regressed (2)

| Case | Tags | Baseline | Candidate | Change |
|---|---|---:|---:|---:|
| `q11` | vocabulary-mismatch | 0.500 | 0.200 | -0.300 |
| `q13` | vocabulary-mismatch | 0.500 | 0.333 | -0.167 |

#### Fixed (2)

| Case | Tags | Baseline | Candidate | Change |
|---|---|---:|---:|---:|
| `q15` | negation | 0.333 | 1.000 | +0.667 |
| `q21` | distractor | 0.333 | 1.000 | +0.667 |

<sub>Compared with [evalboard](https://mohsinaliwork686-rgb.github.io/evalboard/).</sub>
