import { formatEther, formatUnits, parseEther } from 'ethers/lib/utils';
import { MAX_UINT_AMOUNT, RAY, WAD_RAY_RATIO } from '../../helpers/constants';
import { DRE, evmRevert, evmSnapshot, increaseTime, waitForTx } from '../../helpers/misc-utils';
import { TestEnv, makeSuite } from './helpers/make-suite';
const { expect } = require('chai');

import {
  calcExpectedReserveDataAfterBorrow,
  configuration as calculationsConfiguration,
} from './helpers/utils/calculations';

import { BigNumber } from 'bignumber.js';
import './helpers/utils/math';
import { borrow, configuration, deposit, getTxCostAndTimestamp, mint } from './helpers/actions';
import {
  calcExpectedATokenBalance,
  calcExpectedReserveDataAfterMintUnbacked,
  calcExpectedUtilizationRate,
  calcExpectedVariableBorrowIndex,
  calcExpectedVariableDebtTokenBalance,
} from './helpers/utils/calculations';
import { AavePools, iAavePoolAssets, IReserveParams, RateMode } from '../../helpers/types';
import { getReserveData } from './helpers/utils/helpers';
import { getReservesConfigByPool } from '../../helpers/configuration';
import { ReserveData, UserReserveData } from './helpers/utils/interfaces';

const expectEqual = (
  actual: UserReserveData | ReserveData,
  expected: UserReserveData | ReserveData
) => {
  expect(actual).to.be.almostEqualOrEqual(expected);
};

const cumulateToLiquidityIndex = (
  liquidityIndex: BigNumber,
  totalLiquidity: BigNumber,
  amount: BigNumber
) => {
  const amountToLiquidityRatio = amount.wadToRay().rayDiv(totalLiquidity.wadToRay());
  return amountToLiquidityRatio.plus(RAY).rayMul(liquidityIndex);
};

/*makeSuite('Bridge-logic testing with no borrows', (testEnv: TestEnv) => {
  const depositAmount = new BigNumber(parseEther('1000').toString());
  const withdrawAmount = new BigNumber(parseEther('100').toString());
  const feeBP = new BigNumber(30);
  const denominatorBP = new BigNumber(10000);

  const mintAmount = withdrawAmount.multipliedBy(denominatorBP.minus(feeBP)).div(denominatorBP);
  const feeAmount = withdrawAmount.multipliedBy(feeBP).div(denominatorBP);

  it('User 0 deposit 1000 dai.', async () => {
    const { users, pool, dai, aDai } = testEnv;
    await dai.connect(users[0].signer).mint(depositAmount.toFixed(0));
    await dai.connect(users[0].signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(users[0].signer)
      .deposit(dai.address, depositAmount.toFixed(0), users[0].address, 0);

    const reserveData = await pool.getReserveData(dai.address);

    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq('0');
    expect((await aDai.totalSupply()).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect(reserveData.unbackedUnderlying.toString()).to.be.eq('0');
    expect(reserveData.liquidityIndex.toString()).to.be.eq(RAY);
  });

  it('User 1 perform fast withdraw 100 aDAi from L2', async () => {
    const { users, pool, dai, aDai } = testEnv;
    await pool
      .connect(users[1].signer)
      .mintUnbacked(dai.address, mintAmount.toFixed(0), users[1].address, 0);
    const reserveData = await pool.getReserveData(dai.address);

    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq(mintAmount.toFixed(0));
    expect((await aDai.totalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).toFixed(0)
    );
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).toFixed(0)
    );
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect(reserveData.unbackedUnderlying.toString()).to.be.eq(mintAmount.toFixed(0));
    expect(reserveData.liquidityIndex.toString()).to.be.eq(RAY);
  });

  it('Bridged funds used to back unbacked', async () => {
    // Let user 2 be bridge for now
    const { users, pool, dai, aDai } = testEnv;
    await dai.connect(users[2].signer).mint(withdrawAmount.toFixed(0));
    await dai.connect(users[2].signer).approve(pool.address, MAX_UINT_AMOUNT);

    const liquidityIndexBefore = new BigNumber(
      (await pool.getReserveData(dai.address)).liquidityIndex.toString()
    );
    const totalSupplyBefore = new BigNumber((await aDai.totalSupply()).toString());

    const user0ScaledBalanceBefore = new BigNumber(
      (await aDai.scaledBalanceOf(users[0].address)).toString()
    );
    const user1ScaledBalanceBefore = new BigNumber(
      (await aDai.scaledBalanceOf(users[1].address)).toString()
    );

    await pool
      .connect(users[2].signer)
      .backUnbacked(dai.address, mintAmount.toFixed(0), feeAmount.toFixed(0));

    const poolReserveDataAfter = await pool.getReserveData(dai.address);
    const liqIndex = cumulateToLiquidityIndex(liquidityIndexBefore, totalSupplyBefore, feeAmount);

    expect(poolReserveDataAfter.liquidityIndex.toString()).to.be.eq(liqIndex.toFixed(0));
    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(
      user0ScaledBalanceBefore.rayMul(liqIndex).toFixed(0)
    );
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq(
      user1ScaledBalanceBefore.rayMul(liqIndex).toFixed(0)
    );
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).toFixed(0)
    );
    expect((await aDai.totalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).rayMul(liqIndex).toFixed(0)
    );
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(
      depositAmount.plus(withdrawAmount).toFixed(0)
    );
    expect(poolReserveDataAfter.unbackedUnderlying.toString()).to.be.eq('0');
  });

  it('User 3 `backUnbacked` with 0 unbackedUnderlying. 100% in amount and 100% in fee', async () => {
    const { users, pool, dai, aDai } = testEnv;

    await dai.connect(users[3].signer).mint(parseEther('1000'));
    await dai.connect(users[3].signer).approve(pool.address, MAX_UINT_AMOUNT);

    const snap = await evmSnapshot();

    await pool.connect(users[3].signer).backUnbacked(dai.address, parseEther('500'), 0);
    const reserveDataAfterAmount = await pool.getReserveData(dai.address);
    const aDaiBalanceUser0AfterAmount = (await aDai.balanceOf(users[0].address)).toString();
    const aDaiBalanceUser1AfterAmount = (await aDai.balanceOf(users[1].address)).toString();
    const scaledSupply = (await aDai.scaledTotalSupply()).toString();
    const supply = (await aDai.totalSupply()).toString();
    const underlying = (await dai.balanceOf(aDai.address)).toString();

    await evmRevert(snap);

    await pool.connect(users[3].signer).backUnbacked(dai.address, 0, parseEther('500'));
    const reserveDataAfterFee = await pool.getReserveData(dai.address);

    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(
      aDaiBalanceUser0AfterAmount
    );
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq(
      aDaiBalanceUser1AfterAmount
    );
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(scaledSupply);
    expect((await aDai.totalSupply()).toString()).to.be.eq(supply);
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(underlying);

    Object.keys(reserveDataAfterFee).forEach((key) => {
      expect(reserveDataAfterAmount[key].toString()).to.be.eq(reserveDataAfterFee[key].toString());
    });
  });
});*/

makeSuite('Bridge-logic testing with borrows', (testEnv: TestEnv) => {
  const depositAmount = new BigNumber(parseEther('1000').toString());
  const borrowAmount = new BigNumber(parseEther('200').toString());
  const withdrawAmount = new BigNumber(parseEther('100').toString());
  const feeBP = new BigNumber(30);
  const denominatorBP = new BigNumber(10000);

  const mintAmount = withdrawAmount.multipliedBy(denominatorBP.minus(feeBP)).div(denominatorBP);
  const feeAmount = withdrawAmount.multipliedBy(feeBP).div(denominatorBP);

  before('', async () => {
    // TODO: Taken from `scenario.spec.ts`
    calculationsConfiguration.reservesParams = <iAavePoolAssets<IReserveParams>>(
      getReservesConfigByPool(AavePools.proto)
    );
  });

  it('User 0 deposit 1000 dai.', async () => {
    const { users, pool, dai, aDai } = testEnv;
    await dai.connect(users[0].signer).mint(depositAmount.toFixed(0));
    await dai.connect(users[0].signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(users[0].signer)
      .deposit(dai.address, depositAmount.toFixed(0), users[0].address, 0);

    const reserveData = await pool.getReserveData(dai.address);

    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq('0');
    expect((await aDai.totalSupply()).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(depositAmount.toFixed(0));
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(depositAmount.toFixed(0));
    expect(reserveData.unbackedUnderlying.toString()).to.be.eq('0');
    expect(reserveData.liquidityIndex.toString()).to.be.eq(RAY);
  });

  it('User 0 borrows 200 dai', async () => {
    const { users, pool, dai, aDai, helpersContract } = testEnv;
    await pool
      .connect(users[0].signer)
      .borrow(dai.address, borrowAmount.toFixed(0), RateMode.Variable, 0, users[0].address);
  });

  it('User 1 perform fast withdraw 100 aDAi from L2', async () => {
    const { users, pool, dai, aDai, helpersContract } = testEnv;
    const reserveDataBefore = await getReserveData(helpersContract, dai.address);
    const tx = await waitForTx(
      await pool
        .connect(users[1].signer)
        .mintUnbacked(dai.address, mintAmount.toFixed(0), users[1].address, 0)
    );
    const { txTimestamp } = await getTxCostAndTimestamp(tx);
    const expectedDataAfter = calcExpectedReserveDataAfterMintUnbacked(
      mintAmount.toFixed(0),
      reserveDataBefore,
      txTimestamp
    );
    const reserveDataAfter = await getReserveData(helpersContract, dai.address);
    expectEqual(reserveDataAfter, expectedDataAfter);
  });

  it('Wait 7 days', async () => {
    const { users, pool, dai, aDai, helpersContract } = testEnv;

    const reserveDataBefore = await getReserveData(helpersContract, dai.address);

    await increaseTime(60 * 60 * 24 * 7);

    caclExpected;

    const reserveDataAfter = await getReserveData(helpersContract, dai.address);

    console.log(reserveDataBefore);
    console.log(reserveDataAfter);
  });

  it.skip('Bridged funds used to back unbacked', async () => {
    // Let user 2 be bridge for now
    const { users, pool, dai, aDai } = testEnv;
    await dai.connect(users[2].signer).mint(withdrawAmount.toFixed(0));
    await dai.connect(users[2].signer).approve(pool.address, MAX_UINT_AMOUNT);

    const liquidityIndexBefore = new BigNumber(
      (await pool.getReserveData(dai.address)).liquidityIndex.toString()
    );
    const totalSupplyBefore = new BigNumber((await aDai.totalSupply()).toString());

    const user0ScaledBalanceBefore = new BigNumber(
      (await aDai.scaledBalanceOf(users[0].address)).toString()
    );
    const user1ScaledBalanceBefore = new BigNumber(
      (await aDai.scaledBalanceOf(users[1].address)).toString()
    );

    await pool
      .connect(users[2].signer)
      .backUnbacked(dai.address, mintAmount.toFixed(0), feeAmount.toFixed(0));

    const poolReserveDataAfter = await pool.getReserveData(dai.address);
    const liqIndex = cumulateToLiquidityIndex(liquidityIndexBefore, totalSupplyBefore, feeAmount);

    expect(poolReserveDataAfter.liquidityIndex.toString()).to.be.eq(liqIndex.toFixed(0));
    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(
      user0ScaledBalanceBefore.rayMul(liqIndex).toFixed(0)
    );
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq(
      user1ScaledBalanceBefore.rayMul(liqIndex).toFixed(0)
    );
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).toFixed(0)
    );
    expect((await aDai.totalSupply()).toString()).to.be.eq(
      depositAmount.plus(mintAmount).rayMul(liqIndex).toFixed(0)
    );
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(
      depositAmount.plus(withdrawAmount).toFixed(0)
    );
    expect(poolReserveDataAfter.unbackedUnderlying.toString()).to.be.eq('0');
  });

  it.skip('User 3 `backUnbacked` with 0 unbackedUnderlying. 100% in amount and 100% in fee', async () => {
    const { users, pool, dai, aDai } = testEnv;

    await dai.connect(users[3].signer).mint(parseEther('1000'));
    await dai.connect(users[3].signer).approve(pool.address, MAX_UINT_AMOUNT);

    const snap = await evmSnapshot();

    await pool.connect(users[3].signer).backUnbacked(dai.address, parseEther('500'), 0);
    const reserveDataAfterAmount = await pool.getReserveData(dai.address);
    const aDaiBalanceUser0AfterAmount = (await aDai.balanceOf(users[0].address)).toString();
    const aDaiBalanceUser1AfterAmount = (await aDai.balanceOf(users[1].address)).toString();
    const scaledSupply = (await aDai.scaledTotalSupply()).toString();
    const supply = (await aDai.totalSupply()).toString();
    const underlying = (await dai.balanceOf(aDai.address)).toString();

    await evmRevert(snap);

    await pool.connect(users[3].signer).backUnbacked(dai.address, 0, parseEther('500'));
    const reserveDataAfterFee = await pool.getReserveData(dai.address);

    expect((await aDai.balanceOf(users[0].address)).toString()).to.be.eq(
      aDaiBalanceUser0AfterAmount
    );
    expect((await aDai.balanceOf(users[1].address)).toString()).to.be.eq(
      aDaiBalanceUser1AfterAmount
    );
    expect((await aDai.scaledTotalSupply()).toString()).to.be.eq(scaledSupply);
    expect((await aDai.totalSupply()).toString()).to.be.eq(supply);
    expect((await dai.balanceOf(aDai.address)).toString()).to.be.eq(underlying);

    Object.keys(reserveDataAfterFee).forEach((key) => {
      expect(reserveDataAfterAmount[key].toString()).to.be.eq(reserveDataAfterFee[key].toString());
    });
  });
});
