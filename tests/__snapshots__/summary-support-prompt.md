### evalboard: `support-prompt-v1` → `support-prompt-v2`

**5 cases regressed** while the mean score rose from 0.710 to 0.740.

| | Baseline | Candidate | Change |
|---|---:|---:|---:|
| Mean score | 0.710 | 0.740 | +0.030 |
| Pass rate | 82.2% (37/45) | 86.7% (39/45) | +4.4 pts |

5 regressed · 7 fixed · 0 worse · 33 better · 0 unchanged

A case passes when its score is at least 0.5, unless the file gives its own `passed`.

#### Regressed (5)

| Case | Tags | Baseline | Candidate | Change |
|---|---|---:|---:|---:|
| `refund-after-30-days` | refunds | 0.900 | 0.100 | -0.800 |
| `refund-damaged-item` | refunds | 0.900 | 0.100 | -0.800 |
| `refund-gift-card` | refunds | 0.900 | 0.100 | -0.800 |
| `refund-partial-order` | refunds | 0.900 | 0.100 | -0.800 |
| `refund-subscription` | refunds | 0.900 | 0.100 | -0.800 |

#### Fixed (7)

| Case | Tags | Baseline | Candidate | Change |
|---|---|---:|---:|---:|
| `billing-payment-methods` | billing | 0.370 | 0.610 | +0.240 |
| `product-compatibility` | product | 0.420 | 0.640 | +0.220 |
| `shipping-split-order` | shipping | 0.390 | 0.590 | +0.200 |
| `account-2fa-lost-phone` | accounts | 0.480 | 0.610 | +0.130 |
| `product-warranty` | product | 0.480 | 0.600 | +0.120 |
| `shipping-change-date` | shipping | 0.460 | 0.580 | +0.120 |
| `shipping-tracking-missing` | shipping | 0.420 | 0.500 | +0.080 |

<sub>Compared with [evalboard](https://mohsinaliwork686-rgb.github.io/evalboard/).</sub>
