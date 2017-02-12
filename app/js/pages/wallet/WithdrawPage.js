import React, { Component, PropTypes } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { PublicKeychain } from 'blockstack-keychains'

import {
  broadcastTransaction, decryptPrivateKeychain, getNetworkFee,
  getBitcoinPrivateKeychain, getUtxo
} from '../../utils'

import {
  Alert, InputGroup, AccountSidebar, Balance, PageHeader
} from '../../components/index'

import { ECPair, ECKey, TransactionBuilder } from 'bitcoinjs-lib'

function mapStateToProps(state) {
  return {
    account: state.account
  }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch)
}

class WithdrawPage extends Component {
  static propTypes = {

  }

  constructor(props) {
    super(props)
    this.withdrawBitcoin = this.withdrawBitcoin.bind(this)

    this.state = {
      alerts: []
    }
    this.updateAlert = this.updateAlert.bind(this)
    this.onValueChange = this.onValueChange.bind(this)
  }

  onValueChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    })
  }

  updateAlert(alertStatus, alertMessage) {
    this.setState({
      alerts: [{
        status: alertStatus,
        message: alertMessage
      }]
    })
  }

  withdrawBitcoin(event) {
    event.preventDefault()

    const password = this.state.password

    decryptPrivateKeychain(password, this.props.account.encryptedBackupPhrase)
    .then((privateKeychain) => {
     const bitcoinPrivateKeychain = getBitcoinPrivateKeychain(privateKeychain)

     const key = ECPair.fromWIF(bitcoinPrivateKeychain.ecPair.toWIF())
     const address = bitcoinPrivateKeychain.ecPair.getAddress()

     let tx = new TransactionBuilder()
     let totalSatoshis = 0

     const recipientAddress = this.state.recipientAddress

     getUtxo(address).then((utxo) => {

       for(let i = 0; i < utxo.length; i++) {
         let input = utxo[i]
         tx.addInput(input.txid, input.vout)
         totalSatoshis = totalSatoshis + input.satoshis
       }

     let clonedTx = TransactionBuilder.fromTransaction(tx.buildIncomplete())
     clonedTx.addOutput(recipientAddress, totalSatoshis)
     clonedTx.sign(0, key)
     const wrongFeeTransaction = clonedTx.build()
     const byteLength = wrongFeeTransaction.byteLength()


     getNetworkFee(byteLength).then((fee) => {
       const amountToSend = totalSatoshis - fee

       console.log(`Amount to send to ${recipientAddress}: ${amountToSend} Network fee: ${fee}`)

       // TODO: instead of 0 we should use dust amount
       if(amountToSend <= 0) {
          this.updateAlert('danger', "There isn't enough bitcoin to pay the network fee.")
       } else {
         tx.addOutput(recipientAddress, amountToSend)

         tx.sign(0, key)

         const rawTransaction = tx.build().toHex()

         broadcastTransaction(rawTransaction).then((result) => {
           console.log(result)
           this.updateAlert('success', "Transaction sent!")

         }).catch((error) => {
           console.log(error)
           this.updateAlert('danger', "There was a problem broadcasting the transaction")
         })
       }
     })

     }).catch((error) => {
       this.updateAlert('danger', error.toString())

       console.error(error)
     })


    }).catch((error) => {
      this.updateAlert('danger', error.toString())

      console.error(error)
    })
  }

  render() {
    return (
      <div className="body-inner-white">
        <PageHeader title="Withdraw" />
        <div className="container vertical-split-content">
          <div className="row">
            <div className="col-md-3">
              <AccountSidebar activeTab="withdraw" />
            </div>
            <div className="col-md-9">
            { this.state.alerts.map(function(alert, index) {
              return (
                <Alert key={index} message={alert.message} status={alert.status} />
              )
            })}
              <Balance/>
              <p>Send your funds to another Bitcoin wallet.</p>
              <form onSubmit={this.withdrawBitcoin}>
              <InputGroup data={this.state} onChange={this.onValueChange} name="recipientAddress" label="Recipient address" placeholder="Recipient address" required={true}/>
              <InputGroup data={this.state} onChange={this.onValueChange} name="password" label="Password" placeholder="Password" type="password" required={true}/>
              <div className="container m-t-40">
                <button className="btn btn-primary" type="submit">Send</button>
              </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(WithdrawPage)
