/*
  Integration tests for the merit library.

  To run these tests, send a PSF token to this address:
  simpleledger:qz9l5w0fvp670a8r48apsv0xqek840320c90neac9g
*/

// npm libraries
const assert = require('chai').assert

// const BCHJS = require('@psf/bch-js')
// const bchjs = new BCHJS()
const BchWallet = require('minimal-slp-wallet/index')

// Unit under test
const Merit = require('../../lib/merit')
// const uut = new Merit({ bchjs })

const PSF_TOKEN_ID =
  '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'

describe('#merit', () => {
  let uut, wallet

  beforeEach(() => {
    wallet = new BchWallet(undefined, { noUpdate: true, interface: 'consumer-api' })
    uut = new Merit({ wallet })
  })

  // describe('#getTokenUtxos', () => {
  //   it('should return token UTXOs for an SLP address', async () => {
  //     const addr = 'simpleledger:qz9l5w0fvp670a8r48apsv0xqek840320c90neac9g'
  //
  //     const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
  //     // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)
  //
  //     assert.isArray(utxos)
  //     assert.equal(
  //       utxos[0].tokenId,
  //       '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'
  //     )
  //   })
  //
  //   it('should return token UTXOs for a BCH address', async () => {
  //     const addr = 'bitcoincash:qz9l5w0fvp670a8r48apsv0xqek840320cf5czgcmk'
  //
  //     const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
  //     // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)
  //
  //     assert.isArray(utxos)
  //     assert.equal(
  //       utxos[0].tokenId,
  //       '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'
  //     )
  //   })
  //
  //   it('should use rest-api interface', async () => {
  //     wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
  //     uut = new Merit({ wallet })
  //
  //     const addr = 'simpleledger:qz9l5w0fvp670a8r48apsv0xqek840320c90neac9g'
  //
  //     const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
  //     // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)
  //
  //     assert.isArray(utxos)
  //     assert.equal(
  //       utxos[0].tokenId,
  //       '38e97c5d7d3585a2cbf3f9580c82ca33985f9cb0845d4dcce220cb709f9538b0'
  //     )
  //   })
  // })
  //
  // describe('#getTokenQuantity', () => {
  //   it('should return the PSF tokens held by an address using consumer-api', async () => {
  //     const addr = 'simpleledger:qrrh8reyhqgrw0ly884snn4llxgs44lkfcly2vlrsh'
  //
  //     const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
  //     // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)
  //
  //     const tokenQty = uut.getTokenQuantity(utxos)
  //     // console.log(`tokenQty: ${tokenQty}`)
  //
  //     assert.isNumber(tokenQty)
  //   })
  //
  //   it('should return the PSF tokens held by an address using rest-api', async () => {
  //     wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
  //     uut = new Merit({ wallet })
  //
  //     const addr = 'simpleledger:qrrh8reyhqgrw0ly884snn4llxgs44lkfcly2vlrsh'
  //
  //     const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
  //     // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)
  //
  //     const tokenQty = uut.getTokenQuantity(utxos)
  //     // console.log(`tokenQty: ${tokenQty}`)
  //
  //     assert.isNumber(tokenQty)
  //   })
  // })

  describe('#findTokenParent', () => {
    it('should get the parent of a token UTXO using rest-api', async () => {
      // Note: This test must use the rest-api interface to pass.
      wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
      uut = new Merit({ wallet })

      const addr = 'bitcoincash:qzjgc7cz99hyh98yp4y6z5j40uwnd78fw5lx2m4k9t'
      const txid =
        '548198c66640b14c4c175ba5f88d73c63b00f65bc3adc3ea2e94fc41919c6c75'

      const parentUtxo = await uut.findTokenParent(txid, addr)
      // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}`)

      assert.equal(
        parentUtxo.tx_hash,
        'b7b28a03575bae28c421306fe6727d26c8a6c109b03dfdd276e7bfe32d83e850'
      )
    })

    // This test case exists to emphasis the limitations for the consumer-api.
    // The TX history is clipped to 100 entries, and the parent is older than
    // that, so the function returns false.
    it('should return false using consumer-api', async () => {
      wallet = new BchWallet(undefined, { noUpdate: true, interface: 'consumer-api' })
      uut = new Merit({ wallet })

      const addr = 'bitcoincash:qzjgc7cz99hyh98yp4y6z5j40uwnd78fw5lx2m4k9t'
      const txid =
        '548198c66640b14c4c175ba5f88d73c63b00f65bc3adc3ea2e94fc41919c6c75'

      const parentUtxo = await uut.findTokenParent(txid, addr)
      // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}`)

      assert.equal(parentUtxo, false)
    })
  })

  describe('#getParentAge', () => {
    it('should get the age of the oldest parent', async () => {
      // This test will fail unless rest-api interface is used.
      wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
      uut = new Merit({ wallet })

      const addr = 'bitcoincash:qqlrzp23w08434twmvr4fxw672whkjy0py26r63g3d'
      const txid =
        'b79a8c9522ad707275f1fcc7fcd07affe0a4c6dd4abb20d0dac8c7b3320f4002'

      const parentUtxo = await uut.getParentAge(txid, addr)
      // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}`)

      assert.property(parentUtxo, 'height')
      assert.property(parentUtxo, 'tx_hash')
      assert.property(parentUtxo, 'tx_pos')

      assert.equal(parentUtxo.height, 665153)
    })

    it('should return oldest parent when multiple parents exist in a UTXO', async () => {
      // This test will fail unless rest-api interface is used.
      wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
      uut = new Merit({ wallet })

      const addr = 'bitcoincash:qqf4yw03fevffd0yzhp2c88n06yzadhp4yzdlrp0dz'
      const txid =
        '78f8d849032dd34a3f86fa87e7eeb7ccb5c07794bd910d5b9fab29d7706c3b3d'

      const parentUtxo = await uut.findTokenParent(txid, addr)
      // console.log(`parentUtxo: ${JSON.stringify(parentUtxo, null, 2)}`)

      assert.equal(parentUtxo.height, 678013)
    })
  })

  describe('#calcMerit', () => {
    it('should calculate age and merit', async () => {
      // This test will fail unless rest-api interface is used.
      wallet = new BchWallet(undefined, { noUpdate: true, interface: 'rest-api' })
      uut = new Merit({ wallet })

      const addr = 'simpleledger:qrrh8reyhqgrw0ly884snn4llxgs44lkfcly2vlrsh'

      const utxos = await uut.getTokenUtxos(addr, PSF_TOKEN_ID)
      // console.log(`utxos: ${JSON.stringify(utxos, null, 2)}`)

      const hydratedUtxos = await uut.calcMerit(utxos, addr)
      // console.log(`hydratedUtxos: ${JSON.stringify(hydratedUtxos, null, 2)}`)

      assert.isArray(hydratedUtxos)
      assert.equal(hydratedUtxos[0].height, 665504)
    })
  })

  describe('#agMerit', () => {
    it('should aggregate merit across multiple UTXOs', async () => {
      const addr = 'simpleledger:qrrh8reyhqgrw0ly884snn4llxgs44lkfcly2vlrsh'

      const merit = await uut.agMerit(addr, PSF_TOKEN_ID)
      // console.log(`merit: ${merit}`)

      assert.isNumber(merit)
    })
  })
})
