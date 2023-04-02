import Web3 from "web3";

/** CELOSAGE:
 * Created as tutorial for Celo developers.
 *    Author: ISAAC J a.k.a Bobelr
 *    Discord: Bobelr#8524
 *    Github: https://github.com/bobeu
 * 
 *    Get started: https://doc.celo.org
 */
// Types and interfaces for Typescript compatibility
export type CNumber = string | number | import("bn.js");
export type SignedTransaction = import("web3-eth-accounts").SignedTransaction;
export interface TrxProps {
  data?: string;
  to?: string;
  privateKey?: string;
  gas?: string | number;
  gasPrice?: CNumber;
  value?: CNumber;
  functionName: string;
}

// Period which cheques are valid
const VALIDITY_WINDOW_IN_HRS = 1;

// Gas cost
const GAS = 1500000;

// Gas price
const GASPRICE = 3000000000;

// If you wish to use the HttpProvider, simply uncomment the next line, and pass the return value to the Web3() constructor.
// var providerUrl = new Web3.providers.HttpProvider("https://alfajores-forno.celo-testnet.org");

// This line let us switch between connecting to local node i.e Ganache or Celo' Alfajores using websocket connection.
export const mode : boolean = true;

// To connncet to Ganache, we will set the HttpsProvider url to http://127.0.0.1 which run on port 8545
const LOCAL_HTTPPROVIDER_URL = new Web3.providers.HttpProvider("http://127.0.0.1:8545");

// Celo's Websocker URI
const SOCKET_URL = "wss://alfajores-forno.celo-testnet.org/ws";

// Construct a new instance of the Celo's Websocket provider.
const WEB_SOCKETPROVIDER = new Web3.providers.WebsocketProvider(SOCKET_URL);

// We create a new web3 instance parsing the provider as an argument.
const web3 = new Web3(mode? LOCAL_HTTPPROVIDER_URL : WEB_SOCKETPROVIDER);

/**Since we want to either connect locally or to the Celo's testnet, we need a way to modify the accounts variable later.
 * This is because how we work with accounts locally is a little different from live network.
*/
let accounts = [
  web3.eth.accounts.privateKeyToAccount("ba28d5cea192f121................................................"), //payee
  web3.eth.accounts.privateKeyToAccount("8c0dc6d793391e9c................................................") // owner
];

/** If mode is local, we use web3.eth.accounts. This will auto connect to local node i.e ganache, and the ganache's accounts are availabe for us to use
  * otherwise, we'll use the HDWallet or explicitly supplied accounts in the .env file.
  * WARNING: 
  *   It is unsafe to store private keys the way we did. This is for tutorial purpose only.
  *   You'd want to use a more secure and subtle way of handling private keys.
*/
if(mode) {
  const newAccounts = web3.eth.accounts;
  for (let i = 0; i < 2; i++) {
    const alc = newAccounts.create("null");
    accounts[i] = alc;
    console.log(`New Account ${alc.address} with index ${i} created `);
  }
}

// We will always get the right account based on the connected mode.
const PAYEE = accounts[0];
const OWNER = accounts[1];

// Let's check the balances to ensure the accounts are working as expected
async function getBalances() {
  /**If mode is local, we generate new accounts using web3 account utils
   * These accounts have no CELO coin in then. Since we need the coin to pay for gas fee,
   * it sounds good if we could make use of ganache as our faucet. 
   * 
   * Note: Ganache is always pre-loaded with 1000 CELO when newly launched.
   * This affirmation is correct at the time of writing this tutorial in April 2023.
   *    It may change in the future.
  */
  if(mode) {
    const receivers = [PAYEE.address, OWNER.address];
    const newAccounts = await web3.eth.getAccounts();
    let index = 0;
    for (const receiver of receivers) {
      const sender = newAccounts[index];
      await web3.eth.sendTransaction({
        from: sender,
        to: receiver,
        gas: 21000,
        value: Web3.utils.toWei("100", "ether")
      }, (error, transactionHash) => {
        if(!error) console.log(`Trxn hash: ${transactionHash}`);
        else console.log(`Trxn Errored: ${error}`);
      })
      index ++;
    }
  }
  const payee_bal = web3.utils.fromWei(await web3.eth.getBalance(String(PAYEE.address)));
  const owner_bal = web3.utils.fromWei(await web3.eth.getBalance(String(OWNER.address)));
  console.log(
    `Payee Balance: ${payee_bal}
     \nOwner Balance: ${owner_bal}
    `
  )
  return { payee_bal, owner_bal}
}

// Utility to broadcast raw transaction that are signed to the network
const sendSignedTransaction = async(signedRawTrx: string | undefined | SignedTransaction, functionName: string) => {
  return await web3.eth.sendSignedTransaction(String(signedRawTrx), (error, hash) => {
    if(!error) console.log(`Hash:, ${hash} \n${functionName} was run.`);
  });
}

// Export the utilities to use anywhere in your program.
export const utils = () => {
  return {
    web3,
    GAS,
    GASPRICE,
    PAYEE: PAYEE,
    OWNER: OWNER,
    VALIDITY_WINDOW_IN_HRS,
    // LOCAL_HTTPPROVIDER_URL,
    // WEB_SOCKETPROVIDER,
    getBalances: getBalances,
    sendSignedTransaction,
    signAndSendTrx: async function (props: TrxProps) {
      const address = PAYEE.address;
      console.log(`\nPreparing to send transaction from ${address}`);
      const { data, to, gas, value, privateKey, functionName } = props;
    
      const signedRawTrx = await web3.eth.accounts.signTransaction(
        {
          data: data,
          to: to,
          gas: gas,
          value: value,
        },
        String(privateKey)
      );
      return await sendSignedTransaction(signedRawTrx.rawTransaction, functionName);
    },
    
  }
}