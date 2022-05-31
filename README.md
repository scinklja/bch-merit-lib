# bch-merit-lib

This library is used to compute 'merit' of a Bitcoin Cash (BCH) address, based on [PSF tokens](https://psfoundation.cash) held by that address.

Merit = Number of PSF tokens X age of PSF tokens (in days)

This library walks the UTXO DAG of the address in order to apply the equation above to each UTXO, then aggregates those calculations into a single number.

Note: This library behaves differently when using the 'rest-api' (bch-api, bch-js, fullstack.cash) interface vs the 'consumer-api' (web3, free-bch.fullstack.cash). The reason is that the rest-api interface will work with the complete transaction history of an address, whereas the consumer-api interface will clip transaction history at 100 entries. If the merit calculation expands more than 100 tx entries in the addresses history, then older parents won't be counted.

## Installation

```
npm install --save-exact bch-merit-lib
```

## Usage
```javascript
// Instantiate minimal-slp-wallet
const BchWallet = require('minimal-slp-wallet/index')
wallet = new BchWallet(undefined, { noUpdate: true, interface: 'consumer-api' })

// Instantiate the Merit library
const Merit = require('bch-merit-lib/index')
merit = new Merit({ wallet })
```


# Licence

[MIT](LICENSE.md)
