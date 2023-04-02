import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { abi, bytecode } from "../artifacts/contracts/ChequePayment.sol/ChequePayment.json";
import { utils, CNumber, SignedTransaction, mode } from "./accountsUtils";

async function main() {
  // Import the utilities
  const {
    web3,
    GAS,
    PAYEE, 
    OWNER, 
    GASPRICE,
    getBalances,
    signAndSendTrx,
    sendSignedTransaction,
    VALIDITY_WINDOW_IN_HRS } = utils();

  await getBalances();

  // Whether to log data to console or not. You can always toggle it.
  let logData = false;

  // Create an instance of the Chequepayment contract 
  var chequePayment = new web3.eth.Contract(abi as AbiItem[]);

  // Run the constructor
  const chequePaymentTrx = chequePayment.deploy({data: bytecode});

  console.log(`Signing deploy transaction from: ${OWNER.address}`)

  // Create the trxn to sign
  const signedRawTrx = mode? await web3.eth.accounts.signTransaction(
    {
      data: chequePaymentTrx.encodeABI(),
      gas: GAS,
      gasPrice: GASPRICE,
    },
    OWNER.privateKey,
    function (error: Error, signedTransaction: SignedTransaction) {
      if(!error) console.log("Signed Transaction: ", signedTransaction);
    }
  ) : await OWNER.signTransaction(
    {
      data: chequePaymentTrx.encodeABI(),
      gas: GAS,
      // gasPrice: GASPRICE,
    },
    (signedTransaction: SignedTransaction) => {
      console.log("Signed Trx: ", signedTransaction);
    }
  )

  console.log("Signed Trx2: ", signedRawTrx.rawTransaction);
  console.log("Sending signed transaction");

  // Send signed transaction
  const receipt = await sendSignedTransaction(signedRawTrx.rawTransaction, "Constructor")
  console.log("Receipt:", receipt); 
  console.log(`Contract Address: ${receipt.contractAddress}`); 
  
  // Create contract instance
  const contractInstance = new web3.eth.Contract(abi as AbiItem[], receipt.contractAddress);
  console.log("contractInstance:", contractInstance);
  
  // Retrieves opencheques
  async function getOpenCheques(funcName: string) {
    await contractInstance.methods.openCheques().call({from: PAYEE.address})
    .then((openCheques: { toString: () => any; }) => {
      console.log(`\nOpenCheques balance after ${funcName} was called : ${openCheques.toString()}`);
    });
  }

  // Owner draws up a new cheque.
  async function drawCheque(amount: CNumber, value: CNumber) {
    const drawCheque = contractInstance.methods.drawCheque(PAYEE.address, amount, VALIDITY_WINDOW_IN_HRS);
    await signAndSendTrx({
      value: value,
      data: drawCheque?.encodeABI(),
      gas: GAS,
      to: receipt.contractAddress,
      privateKey: OWNER.privateKey,
      functionName: "DrawCheque"
    })
    .then(function (receipt: any) { logData && console.log("\nDrawCheque Trx hash", receipt.transactionHash); });
  }

  // Owner can increase the previously drawn cheque
  async function increaseCheque(amount: CNumber, msgValue: CNumber) {
    const increaseChequeValue = contractInstance.methods.increaseChequeValue(PAYEE.address, amount);
    await signAndSendTrx({
      gasPrice: GASPRICE,
      value: msgValue,
      data: increaseChequeValue?.encodeABI(),
      gas: GAS,
      to: receipt.contractAddress,
      privateKey: OWNER.privateKey,
      functionName: 'IncreaseCheque'
    })
    .then(async function(receipt: any){
      logData && console.log("\nTrx receipt: ", receipt);
      await getOpenCheques("IncreaseCheque");
    });
  }

  // Owner can reduce previously drawn cheque
  async function reduceCheque(amount: CNumber) {
    const reduceChequeValue = contractInstance.methods.reduceChequeValue(PAYEE.address, amount);
    await signAndSendTrx({
      gasPrice: GASPRICE,
      data: reduceChequeValue?.encodeABI(),
      gas: GAS,
      to: receipt.contractAddress,
      privateKey: OWNER.privateKey,
      functionName: 'ReduceCheque'
    })
      .then(async function(receipt: any){
        logData && console.log("\nTrx receipt: ", receipt);
        await getOpenCheques("ReduceCheque");
    });
  }

  // Owner is able to cancel cheques provided they're within the cancellation window.
  async function cancelCheque() {
    const cancelDrawnCheque = contractInstance.methods.cancelDrawnCheque(PAYEE.address);
    await signAndSendTrx({
      gasPrice: GASPRICE,
      data: cancelDrawnCheque?.encodeABI(),
      gas: GAS,
      to: receipt.contractAddress,
      privateKey: OWNER.privateKey,
      functionName: 'CancelCheque'
    })
      .then(async function(receipt: any){
        logData && console.log("\nTrx receipt: ", receipt);
        await getOpenCheques("CancelCheque");
    });
  }
  
  // Payee will cashout the cheque if they have one drawn in their favor.
  async function cashout() {
    const cashout = contractInstance.methods.cashout();
    await signAndSendTrx({
      gasPrice: GASPRICE,
      data: cashout?.encodeABI(),
      gas: GAS,
      to: receipt.contractAddress,
      privateKey: PAYEE.privateKey,
      functionName: 'Cashout'
    })
      .then(async function(receipt: any){
        logData && console.log("\nTrx receipt: ", receipt);
        await getOpenCheques("Cashout");
    });
  }
  
  // Initial cheque amount
  const INIT_CHEQUE_AMOUNT = Web3.utils.toBN('10000000000000000');
  const SUB_CHEQUE_AMOUNT = Web3.utils.toBN('20000000000000000');
  let increment = Web3.utils.toBN('50000000000000000');
  let decrement = Web3.utils.toBN('40000000000000000');
  const MSG_VALUE = Web3.utils.toWei("100000000000000000", "wei");
  // logData = true;

  await drawCheque(INIT_CHEQUE_AMOUNT, MSG_VALUE);
  await cancelCheque();
  await drawCheque(SUB_CHEQUE_AMOUNT, MSG_VALUE);
  await increaseCheque(increment, MSG_VALUE);
  await reduceCheque(decrement);
  await cashout();
}  
  // We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});