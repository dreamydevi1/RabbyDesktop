import { useMemo } from 'react';
import styled from 'styled-components';
import BigNumber from 'bignumber.js';

import { noop } from 'lodash';
import clsx from 'clsx';
import { TCexQuoteData, TDexQuoteData, isSwapWrapToken } from '../utils';
import { IconRefresh } from './IconRefresh';
import { QuoteListLoading, QuoteLoading } from './QuoteLoading';
import {
  CexListWrapper,
  CexQuoteItem,
  DexQuoteItem,
  QuoteItemProps,
} from './QuoteItem';
import { CEX, DEX, DEX_WITH_WRAP } from '../constant';
import { InSufficientTip } from './InSufficientTip';
import { useSwapSettings } from '../hooks';
import { SortWithGas } from './SortWithGas';
import { TradingSetting } from './TraddingSetting';

const exchangeCount = Object.keys(DEX).length + Object.keys(CEX).length;

const QuotesWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 20px;
    margin-bottom: 14px;

    .title {
      font-size: 16px;
      font-weight: medium;
      color: white;
    }
  }
`;

interface QuotesProps
  extends Omit<
    QuoteItemProps,
    | 'bestQuoteAmount'
    | 'bestQuoteGasUsd'
    | 'name'
    | 'quote'
    | 'active'
    | 'isBestQuote'
    | 'quoteProviderInfo'
  > {
  list?: (TCexQuoteData | TDexQuoteData)[];
  activeName?: string;
  refresh?: () => void;
}
export const Quotes = (props: QuotesProps) => {
  const {
    list = [],
    loading = false,
    activeName,
    refresh = noop,
    inSufficient,
    ...other
  } = props;
  const {
    swapViewList,
    swapTradeList,
    setSwapSettingVisible,
    sortIncludeGasFee,
  } = useSwapSettings();

  const sortedList = useMemo(
    () => [
      ...(list?.sort((a, b) => {
        const getNumber = (quote: typeof a) => {
          const price = other.receiveToken.price ? other.receiveToken.price : 1;
          if (quote.isDex) {
            if (inSufficient) {
              return new BigNumber(quote.data?.toTokenAmount || 0)
                .div(
                  10 **
                    (quote.data?.toTokenDecimals || other.receiveToken.decimals)
                )
                .times(price);
            }
            if (!quote.preExecResult) {
              return new BigNumber(Number.MIN_SAFE_INTEGER);
            }

            if (sortIncludeGasFee) {
              return new BigNumber(
                quote?.preExecResult.swapPreExecTx.balance_change
                  .receive_token_list?.[0]?.amount || 0
              )
                .times(price)
                .minus(quote?.preExecResult?.gasUsdValue || 0);
            }

            return new BigNumber(
              quote?.preExecResult.swapPreExecTx.balance_change
                .receive_token_list?.[0]?.amount || 0
            ).times(price);
          }

          return quote?.data?.receive_token
            ? new BigNumber(quote?.data?.receive_token?.amount).times(price)
            : new BigNumber(Number.MIN_SAFE_INTEGER);
        };
        return getNumber(b).minus(getNumber(a)).toNumber();
      }) || []),
    ],
    [
      inSufficient,
      list,
      other.receiveToken.decimals,
      other?.receiveToken?.price,
      sortIncludeGasFee,
    ]
  );

  const [bestQuoteAmount, bestQuoteGasUsd] = useMemo(() => {
    const bestQuote = sortedList?.[0];

    return [
      (bestQuote?.isDex
        ? inSufficient
          ? new BigNumber(bestQuote.data?.toTokenAmount || 0)
              .div(
                10 **
                  (bestQuote?.data?.toTokenDecimals ||
                    other.receiveToken.decimals ||
                    1)
              )
              .toString(10)
          : bestQuote?.preExecResult?.swapPreExecTx.balance_change
              .receive_token_list[0]?.amount
        : new BigNumber(bestQuote?.data?.receive_token.amount || '0').toString(
            10
          )) || '0',
      bestQuote?.isDex ? bestQuote.preExecResult?.gasUsdValue || '0' : '0',
    ];
  }, [inSufficient, other?.receiveToken?.decimals, sortedList]);

  const fetchedList = useMemo(() => list.map((e) => e.name), [list]);

  const viewCount = useMemo(() => {
    if (swapViewList) {
      return (
        exchangeCount -
        Object.entries(swapViewList || {}).filter(
          ([key, value]) =>
            (DEX?.[key as keyof typeof DEX] ||
              CEX?.[key as keyof typeof CEX]) &&
            value === false
        ).length
      );
    }
    return exchangeCount;
  }, [swapViewList]);

  const tradeCount = useMemo(() => {
    if (swapTradeList) {
      const TradeDexList = Object.keys(DEX);
      return Object.entries(swapTradeList).filter(
        ([name, enable]) => enable === true && TradeDexList.includes(name)
      ).length;
    }
    return 0;
  }, [swapTradeList]);

  const noCex = useMemo(() => {
    return Object.keys(CEX).every(
      (e) => swapViewList?.[e as keyof typeof CEX] === false
    );
  }, [swapViewList]);

  const noDex = useMemo(() => {
    return Object.keys(DEX).every(
      (e) => swapViewList?.[e as keyof typeof DEX] === false
    );
  }, [swapViewList]);

  if (isSwapWrapToken(other.payToken.id, other.receiveToken.id, other.chain)) {
    const dex = sortedList.find((e) => e.isDex) as TDexQuoteData | undefined;

    return (
      <QuotesWrapper>
        <div className={clsx('header', inSufficient && 'inSufficient')}>
          <div className="flex items-center">
            <div className="title">Found following swap rates</div>
            <IconRefresh refresh={refresh} loading={loading} />
          </div>
          <TradingSetting />
          <SortWithGas />
        </div>

        <InSufficientTip inSufficient={inSufficient} />

        <div className="flex flex-col gap-[16px]">
          {dex ? (
            <DexQuoteItem
              inSufficient={inSufficient}
              preExecResult={dex?.preExecResult}
              quote={dex?.data}
              name={dex?.name}
              isBestQuote
              bestQuoteAmount={`${
                dex?.preExecResult?.swapPreExecTx.balance_change
                  .receive_token_list[0]?.amount || '0'
              }`}
              bestQuoteGasUsd={bestQuoteGasUsd}
              active={activeName === dex?.name}
              isLoading={dex.loading}
              quoteProviderInfo={{
                name: 'Wrap Contract',
                logo: other?.receiveToken?.logo_url,
              }}
              {...other}
            />
          ) : (
            <QuoteLoading
              name="Wrap Contract"
              logo={other?.receiveToken?.logo_url}
            />
          )}

          <div className="text-14 text-white text-opacity-80">
            Wrapping {other.receiveToken.name} tokens directly with the smart
            contract
          </div>
        </div>
      </QuotesWrapper>
    );
  }
  return (
    <QuotesWrapper>
      <div className={clsx('header', inSufficient && 'inSufficient')}>
        <div className="flex items-center">
          <div className="title">Found following swap rates</div>
          <IconRefresh refresh={refresh} loading={loading} />
        </div>
        <TradingSetting />
        <SortWithGas />
      </div>

      <InSufficientTip inSufficient={inSufficient} />

      <div className="flex flex-col gap-[12px]">
        {sortedList.map((params, idx) => {
          const { name, data, isDex } = params;
          if (!isDex) return null;
          return (
            <DexQuoteItem
              inSufficient={inSufficient}
              preExecResult={params.preExecResult}
              quote={data}
              name={name}
              isBestQuote={idx === 0}
              bestQuoteAmount={`${bestQuoteAmount}`}
              bestQuoteGasUsd={bestQuoteGasUsd}
              active={activeName === name}
              isLoading={params.loading}
              quoteProviderInfo={
                DEX_WITH_WRAP[name as keyof typeof DEX_WITH_WRAP]
              }
              {...other}
            />
          );
        })}

        <QuoteListLoading fetchedList={fetchedList} />
      </div>
      {noCex ? null : (
        <>
          <div
            className={clsx(
              'text-white text-opacity-70 text-13 font-medium  mb-8',
              !noDex && 'mt-24'
            )}
          >
            Rates from CEX
          </div>

          <CexListWrapper>
            {sortedList.map((params, idx) => {
              const { name, data, isDex } = params;
              if (isDex) return null;
              return (
                <CexQuoteItem
                  name={name}
                  data={data}
                  bestQuoteAmount={`${bestQuoteAmount}`}
                  bestQuoteGasUsd={bestQuoteGasUsd}
                  isBestQuote={idx === 0}
                  isLoading={params.loading}
                  inSufficient={inSufficient}
                />
              );
            })}
            <QuoteListLoading fetchedList={fetchedList} isCex />
          </CexListWrapper>
        </>
      )}

      <div className="flex justify-center mt-auto text-white opacity-60 text-13 pt-[12px]">
        {viewCount} exchanges offer quotes, and {tradeCount} enable trading.{' '}
        <span
          onClick={() => {
            setSwapSettingVisible(true);
          }}
          className="cursor-pointer text-blue-light underline underline-blue-light"
        >
          Edit
        </span>
      </div>
    </QuotesWrapper>
  );
};
