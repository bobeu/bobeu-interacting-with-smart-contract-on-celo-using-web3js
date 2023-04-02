// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract ChequePayment is Ownable {
  using SafeMath for uint256;

  error InsufficientBalance(uint actualBalance, uint intendedCheque);
  error InsufficientCreditToPayCheque(uint balance, uint actualValue);
  error ChequeExpired(uint validTill, uint currentTimestamp);
  error InsufficientValueToCoverCheque(uint incomingValue);
  error ValueExceedReducer(uint value, uint reducer);
  error PeriodOutOfBound(uint);
  error CancellationGraceElapsed();
  error NoChequeForCaller(address);
  error PayeeIsZeroAddress(address);

  event ChequeDrawn (address indexed payee, uint value);
  event ChequeWithdrawn (uint dateWithdrawn, address beneficiary, uint amount);

  uint private nonce;
  uint public openCheques;
  uint public immutable trGas;

  struct ChequeInfo {
    uint dateDrawn;
    uint validTill;
    uint value;
  }

  mapping (address => ChequeInfo) public payees;

  constructor() {
    trGas = 22000 * 21;
  }

  receive() payable external {}
  
  /**@dev Draws a new cheque in favor of beneficiary - payee
   * @param validityWindowInHrs - Period within which cheque is valid
   * 
   */
  function drawCheque(address payee, uint amount, uint8 validityWindowInHrs) public payable onlyOwner {
    _safeGuardCheques(amount, msg.value);
    if(validityWindowInHrs >= type(uint8).max) revert PeriodOutOfBound(validityWindowInHrs);
    if(payee == address(0)) revert PayeeIsZeroAddress(payee);
    uint vwIh = _now().add(validityWindowInHrs * 1 hours);
    payees[payee] = ChequeInfo(
      _now(),
      vwIh,
      amount
    );
    
    emit ChequeDrawn(payee, amount);
  }

  function cancelDrawnCheque(address payee) public onlyOwner {
    ChequeInfo memory cInfo = payees[payee];
    if(_now() >= cInfo.dateDrawn.add(6 hours)) revert CancellationGraceElapsed();
    if(openCheques >= cInfo.value) openCheques = openCheques.sub(cInfo.value);
    payees[payee] = ChequeInfo(0, 0, 0);
  }

  function reduceChequeValue(address payee, uint reducer) public onlyOwner {
    openCheques = openCheques.sub(reducer);
    ChequeInfo memory ci = payees[payee];
    if(ci.value < reducer) revert ValueExceedReducer(ci.value, reducer);
    unchecked {
      payees[payee].value = ci.value - reducer;
    }
  }

  function _safeGuardCheques (uint amount, uint incomingValue) internal {
    uint balance = address(this).balance;
    uint _supposetotalCheques = openCheques.add(amount).add(trGas);
    if(_supposetotalCheques > balance) {
      if(incomingValue < _supposetotalCheques.sub(balance)) revert InsufficientValueToCoverCheque(incomingValue);
    }
    unchecked {
      openCheques += amount;
    }
  }

  function increaseChequeValue(address payee, uint amount) public payable onlyOwner {
    _safeGuardCheques(amount, msg.value);
    ChequeInfo memory ci = payees[payee];
    require(ci.value > 0, "Payee not found");
    payees[payee].value = ci.value + amount;
  }

  function cashout() public {
    ChequeInfo memory cInfo = payees[_msgSender()];
    if(cInfo.value == 0) revert NoChequeForCaller(_msgSender());
    if(_now() > cInfo.validTill) revert ChequeExpired(cInfo.validTill, _now());
    payees[_msgSender()] = ChequeInfo(0, 0, 0);
    uint balance = address(this).balance;
    uint transferAmt = cInfo.value;
    if(balance < cInfo.value.add(trGas)) revert InsufficientCreditToPayCheque(balance, cInfo.value.add(trGas));
    require(openCheques >= transferAmt, "Cheque anomally");
    openCheques = openCheques.sub(transferAmt);
    Address.sendValue(payable(_msgSender()), cInfo.value);
  }

  function _now() internal view returns(uint) {
    return block.timestamp;
  }
}
