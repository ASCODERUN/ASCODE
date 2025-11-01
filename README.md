# DIMDOX

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Web3-green.svg)](https://solana.com/)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/ontora-ai.svg)](https://github.com/yourusername/ontora-ai/issues)

[![Website](https://img.shields.io/badge/Website-DIMDOX-blue?logo=google-chrome)](https://dimdox.tech/)
[![Twitter](https://img.shields.io/badge/Twitter-DIMDOX-blue?logo=twitter)](https://x.com/DIMDOXBLOCK)


DIMDOX is a blockchain archive system designed to record the dimensional trajectory of every on-chain existence.

Every wallet and every interaction is mapped as a coordinate, forming an expansive dimensional map, a record of movement, intention, and existence itself.

These data points aggregate, shift, and overlap along the timeline, forming unique dimensional patterns.

In the logic of DIMDOX, there is no distinction between active and idle.
There are only different frequencies of existence. Low-frequency accounts form the cold layers, while high-frequency behaviors construct the hot layers. Together, they compose an evolving dimensional topology.

As on-chain events continue to accumulate, the system automatically generates a Dimensional ID. This is not an identity credential but a structural signature derived from behavioral patterns.

Each Dimensional ID represents a logic of being, a multi-dimensional form defined by rhythm, interaction frequency, and participation dynamics.

DIMDOX does not preserve the past. It rearranges time.
All events are reindexed, compressed, and restructured to generate a spatial model of on-chain behavior, an archive that remains structurally coherent within constant transformation.

In this system, data is not merely recorded but relocated and realigned.
The goal of DIMDOX is not to narrate but to prove that on-chain existence can be quantified as dimensional structure rather than linear history.

This is the absolute core of DIMDOX:
Transforming on-chain events into a normalized vector and hashing it into a Dimensional ID.

```
import hashlib, json, math, time
from collections import defaultdict

def build_dimensional_vector(events):
    now = time.time()
    v = defaultdict(float)
    for e in events:
        age = now - e["ts"]
        w = math.exp(-age / 604800)
        v[e["program"]] += w
        v[e["kind"]] += w
    s = math.sqrt(sum(x*x for x in v.values())) or 1
    return {k: x/s for k, x in v.items()}

def dimensional_id(addr, vec):
    data = {"addr": addr, "v": {k: round(v,3) for k,v in sorted(vec.items())}}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

# example
events = [{"ts": time.time()-1000, "program":"PUMP", "kind":"swap"},
          {"ts": time.time()-200, "program":"JUP", "kind":"transfer"}]
vec = build_dimensional_vector(events)
print(dimensional_id("wallet_address", vec))
```

