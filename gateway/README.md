# CXID Gateway

A CCIP Read gateway that is designed to integrate exchanges and power ENS integrations at scale.
This gateway only supports resolving ENS names to addresses, optionally with a specified coin.

The gateway implements a cache from which it looks up records. If the record is not in the cache or has expired, the
value is requested from the integrated exchange. If the value is loaded successfully, it is resolved. Otherwise,
an error is returned.
