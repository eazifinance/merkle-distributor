// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICoreController {
    /**
     * @dev Returns liquidity data across all vaults and various partners
     * @param account The account
     * @return savingsBalanceInBaseCurrency The total savings balance of the account in Base Currency
     * @return outstandingDebtInBaseCurrency the outstanding debt of the account in Base Currency
     * @return availableCreditInBaseCurrency The available credit limit of the account in Base Currency
     * @return currentLiquidationThreshold The liquidation threshold of the account
     * @return ltv the loan to value of the account
     * @return healthFactor the current health factor of the account, as represented internally
     **/
    function getAccountLiquidityData(address account)
        external
        view
        returns (
            uint256 savingsBalanceInBaseCurrency,
            uint256 outstandingDebtInBaseCurrency,
            uint256 availableCreditInBaseCurrency,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
