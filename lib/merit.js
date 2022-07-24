/*
  This library calculates metrics that are used to assess an addresses 'merit' or
  standing within the PSF community. Merit it defined as:

  merit = token quantity x token age
*/

// npm libraries

// const PSF_TOKEN_ID =
//   '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'

class Merit {
  constructor (config = {}) {
    this.env = config.env
    // console.log(`config.env: ${JSON.stringify(this.env, null, 2)}`)

    // Require instance of minimal-slp-wallet when instantiating this library.
    if (!config.wallet) {
      throw new Error(
        'Instance of minimal-slp-wallet must be passed in the config object when instantiating.'
      )
    }
    this.wallet = config.wallet

    // console.log(
    //   `Initializing MeritLib with interface: ${this.wallet.ar.interface}`
    // )

    // Encapsulate dependencies
    this.bchjs = config.wallet.bchjs
  }

  // Given an address, this function retrieves the UTXOs associated with the
  // address, hydrates them with SLP data, and returns the ones that match
  // token ID. This is the first step in calculating merit.
  //
  // Specify the selected SLP token with tokenId.
  // utxoDelay is a number representing the number of milliseconds to wait
  // between UTXOs, in order to prevent triggering rate limits.
  async getTokenUtxos (address, tokenId, utxoDelay) {
    try {
      /*
      if (!tokenId) {
        throw new Error('tokenId must be specified!')
      }
      */

      address = this.bchjs.SLP.Address.toCashAddress(address)

      const utxos = await this.wallet.getUtxos(address)
      if (this.env.VERBOSE_LOG === '1') console.log(`getUtxos/utxos: ${JSON.stringify(utxos, null, 2)}`)

      // Filter out the UTXOs that represent PSF tokens.

      let matchedUtxos
      if (tokenId) {
        matchedUtxos = utxos.slpUtxos.type1.tokens.filter(
          elem => elem.tokenId && elem.tokenId.includes(tokenId)
        )
      } else {
        matchedUtxos = utxos.bchUtxos.filter(
          elem => !elem.tokenId
        )
      }

      return matchedUtxos
    } catch (err) {
      console.error('Error in merit.js/getTokenUtxos()')
      throw err
    }
  }

  // Expects the output from getTokenUtxos() as the input to this function.
  // This function adds up all the PSF tokens and returns the total amount
  // of PSF tokens held by the address.
  getTokenQuantity (hydratedUtxos) {
    try {
      let qty = 0

      hydratedUtxos.map(elem => {
        qty += Number(elem.tokenQty)
      })

      return qty
    } catch (err) {
      console.error('Error in merit.js/getTokenQuantity()')
      throw err
    }
  }

  // Expects the output from getTokenUtxos() as the input to this function.
  // Returns an array of UTXOs. Each element will have additional 'merit'
  // and 'age' properties.
  // The formula for calculating merit is:
  // merit = token quantity x number of days held
  // There are 144 blocks in a day (on average).
  async calcMerit (hydratedUtxos, address, tokenId) {
    try {
      if (!Array.isArray(hydratedUtxos)) {
        throw new Error('Input hydratedUtxo must be an array')
      }

      // Convert the address to `bitcoincash` format.
      const bchAddr = this.bchjs.SLP.Address.toCashAddress(address)
      // console.log(`bchAddr: ${bchAddr}`)
      const BLOCKS_IN_A_DAY = 144

      let currentBlockHeight = 0
      if (this.env.MERIT_AGE === '1') { currentBlockHeight = await this.bchjs.Blockchain.getBlockCount() }
      // console.log(`currentBlockHeight: ${currentBlockHeight}`)

      // Calculate merit and age for each UTXO.
      const updatedUtxos = []
      for (let i = 0; i < hydratedUtxos.length; i++) {
        const elem = hydratedUtxos[i]
        // console.log(`elem: ${JSON.stringify(elem, null, 2)}`)

        let age = 0
        if (this.env.MERIT_AGE === '1') {
          let height = elem.height

          // Get the token UTXO info for the oldest parent of this UTXO,
          // originating from this same address.
          const parentUtxo = await this.getParentAge(elem.tx_hash, bchAddr)
          // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}`)

          // Replace the height of the UTXO if it has an older parent.
          if (parentUtxo) height = parentUtxo.height

          // Calculate the age of the UTXO.
          age = (currentBlockHeight - height) / BLOCKS_IN_A_DAY

          // Round the age to two decimal places.
          age = this.bchjs.Util.floor2(age)

          // Corner case: unconfirmed UTXOs.
          if (elem.height === 0) age = 0
        }

        let merit
        if (tokenId) { merit = Number(elem.tokenQty) } else { merit = elem.value / 100000000 }
        if (this.env.MERIT_AGE === '1') { merit = merit * age }

        // Add these new properties to the UTXO
        elem.age = age
        elem.merit = merit

        updatedUtxos.push(elem)
      }

      return updatedUtxos
    } catch (err) {
      console.error('Error in merit.js/getMerit()')
      throw err
    }
  }

  // Walks the UTXO history to find the oldest parent from the same address.
  // Returns the old block height for the tokens history that originates
  // from the address.
  //
  // This prevent people from destorying their token age when sending tokens.
  async getParentAge (txid, addr) {
    try {
      let oldestUtxo = false // Default value.

      // Loop through the DAG to find the oldest parent token UTXO.
      // for(let i=0; i < 9; i++) {
      // let i = 0
      while (txid) {
        // console.log(`Iteration ${i}`)
        const parentUtxo = await this.findTokenParent(txid, addr)
        // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}\n`)

        txid = parentUtxo.tx_hash
        // i++

        if (parentUtxo) oldestUtxo = parentUtxo
      }

      return oldestUtxo
    } catch (err) {
      console.error('Error in merit.js/getParentAge()')
      throw err
    }
  }

  // Given an SLP token txid and an address as input, this function will return
  // the UTXO information for the parent UTXO, if that UTXO originated from the
  // same address. Otherwise, it returns false, to indicate the parent transaction
  // could not be found in the transaction history for that address.
  //
  // This is a primative function that is called by getParentAge, which
  // looks for the oldest SLP token UTXO that originated from the address.
  //
  // This is an older version of calculating the parent age. This is a more robust
  // calculation that is less prone to manipulation. But it's also simplier and
  // will not handle sophistocated UTXO DAGs. It assumes that only wallet.fullstack.cash
  // is used to handle the tokens. It will fail when anlyzing UTXOs from other
  // wallets like EC SLP.
  // https://github.com/Permissionless-Software-Foundation/bch-message-lib/blob/6247d0cbd4819d4068c4ea096b2664154b84a3ae/lib/merit.js
  // See this Trello task for reference:
  // https://trello.com/c/kwBhToQq
  //
  // Note: When using the 'consumer-api' interface, this function may give
  // different results than when using the 'rest-api' interface. The reason is
  // that transaction history in the consumer-api is limited to 100 entries. If
  // the transaction history for the parent is older than 100 entries, it won't
  // be counted. The rest-api interface uses the complete transaction history.
  async findTokenParent (txid, addr) {
    try {
      let parentInfo = false // Default return value.

      let txData = await this.wallet.getTxData([txid])
      txData = txData[0]
      // console.log(`txData: ${JSON.stringify(txData, null, 2)}`)

      const childTokenId = txData.tokenId

      // Extract the UTXO input info. (parent UTXOs)
      const parentUtxos = txData.vin.map(elem => {
        return {
          txid: elem.txid,
          vout: elem.vout
        }
      })
      // console.log(`parentUtxos: ${JSON.stringify(parentUtxos, null, 2)}`)

      // Get the transaction history for the given address.
      // const txHistory = await this.bchjs.Electrumx.transactions(addr)
      const txHistory = await this.wallet.getTransactions(addr)
      // console.log(`txHistory: ${JSON.stringify(txHistory, null, 2)}`)

      // Loop through each parent utxo.
      for (let i = 0; i < parentUtxos.length; i++) {
        const parentTxid = parentUtxos[i].txid

        // Search the transaction history for the address for a matching
        // transaction.
        const match = txHistory.filter(
          elem => elem.tx_hash === parentTxid
        )
        // console.log(`match: ${JSON.stringify(match, null, 2)}`)

        // Skip if there is no match.
        if (match.length > 0) {
          // Loop through each match.
          for (let j = 0; j < match.length; j++) {
            const thisUtxo = match[j]
            // console.log(`thisUtxo: ${JSON.stringify(thisUtxo, null, 2)}`)

            const thisTxData = await this.wallet.getTxData([thisUtxo.tx_hash])
            // console.log(`thisTxData: ${JSON.stringify(thisTxData, null, 2)}`)

            const parentTokenId = thisTxData[0].tokenId

            // Add the vout info to complete the minimum UTXO information needed
            // to hydrate the UTXO with token info.
            thisUtxo.tx_pos = parentUtxos[i].vout

            // If the parent UTXO is a valid SLP token UTXO.
            // (and the token IDs match)
            if (thisTxData[0].isValidSlp && childTokenId === parentTokenId) {
              // console.log('utxo is valid')

              parentInfo = thisUtxo
            }
          }
        }
      }

      return parentInfo
    } catch (err) {
      console.error('Error in findTokenParent()')
      throw err
    }
  }

  // Aggregate Merit.
  // This function aggregates the merit across all token UTXOs for an address.
  // It returns a single number, which is the aggregate merit for the address.
  // Inputs:
  // - address (required) is the address to attribute the merit to.
  // - tokenId (required) is the token ID of the SLP token used to stake for accruing merit.
  // - utxoDelay (optional) a delay in milliseconds to wait between processing
  //   UTXOs. Reduces the risk of failure due to rate limits errors.
  async agMerit (address, tokenId, utxoDelay) {
    try {
      if (!address) {
        throw new Error('an address must be specified!')
      }
      /*
      if (!tokenId) {
        throw new Error('tokenId must be specified!')
      }
      */

      // Get a list of UTXOs representing PSF tokens, hydrated with token info.
      const utxos = await this.getTokenUtxos(address, tokenId, utxoDelay)
      if (this.env.VERBOSE_LOG === '1') console.log(`getTokenUtxos/utxos: ${JSON.stringify(utxos, null, 2)}`)

      // Further hydrate the UTXOs with age and merit values.
      const meritUtxos = await this.calcMerit(utxos, address, tokenId)

      let agMerit = 0

      meritUtxos.map(elem => (agMerit += elem.merit))

      return agMerit
    } catch (err) {
      console.error('Error in merit.js/agMerit()')
      throw err
    }
  }
}

module.exports = Merit
