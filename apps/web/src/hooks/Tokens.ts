import { Currency, Token } from '@uniswap/sdk-core'
import { SupportedInterfaceChainId, useSupportedChainId } from 'constants/chains'
import { NATIVE_CHAIN_ID } from 'constants/tokens'
import { useAccount } from 'hooks/useAccount'
import { TokenAddressMap } from 'lib/hooks/useTokenList/utils'
import { useMemo } from 'react'
import { useCombinedInactiveLists } from 'state/lists/hooks'
import { TokenFromList } from 'state/lists/tokenFromList'
import { useUserAddedTokens } from 'state/user/userAddedTokens'
import { UNIVERSE_CHAIN_INFO } from 'uniswap/src/constants/chains'

import { CurrencyInfo } from 'uniswap/src/features/dataApi/types'
import { useCurrencyInfo as useUniswapCurrencyInfo } from 'uniswap/src/features/tokens/useCurrencyInfo'
import { InterfaceChainId, UniverseChainId } from 'uniswap/src/types/chains'
import { buildCurrencyId } from 'uniswap/src/utils/currencyId'
import { isAddress } from 'utilities/src/addresses'

type Maybe<T> = T | undefined

// reduce token map into standard address <-> Token mapping, optionally include user added tokens
function useTokensFromMap(
  tokenMap: TokenAddressMap,
  chainId: Maybe<InterfaceChainId>,
): { [address: string]: TokenFromList } {
  return useMemo(() => {
    if (!chainId) {
      return {}
    }

    // reduce to just tokens
    return Object.keys(tokenMap[chainId] ?? {}).reduce<{ [address: string]: TokenFromList }>((newMap, address) => {
      newMap[address] = tokenMap[chainId][address].token
      return newMap
    }, {})
  }, [chainId, tokenMap])
}

/** Returns all tokens from local lists + user added tokens */
export function useFallbackListTokens(chainId: Maybe<InterfaceChainId>): { [address: string]: Token } {
  const fallbackListTokens = useCombinedInactiveLists()
  const tokensFromMap = useTokensFromMap(fallbackListTokens, chainId)
  const userAddedTokens = useUserAddedTokens()
  return useMemo(() => {
    return (
      userAddedTokens
        // reduce into all ALL_TOKENS filtered by the current chain
        .reduce<{ [address: string]: Token }>(
          (tokenMap, token) => {
            tokenMap[token.address] = token
            return tokenMap
          },
          // must make a copy because reduce modifies the map, and we do not
          // want to make a copy in every iteration
          { ...tokensFromMap },
        )
    )
  }, [tokensFromMap, userAddedTokens])
}

// Check if currency is included in custom list from user storage
export function useIsUserAddedToken(currency: Currency | undefined | null): boolean {
  const userAddedTokens = useUserAddedTokens()

  if (!currency) {
    return false
  }

  return !!userAddedTokens.find((token) => currency.equals(token))
}

export function useCurrency(address?: string, chainId?: InterfaceChainId, skip?: boolean): Maybe<Currency> {
  const currencyInfo = useCurrencyInfo(address, chainId, skip)
  return currencyInfo?.currency
}

/**
 * Returns a CurrencyInfo from the tokenAddress+chainId pair.
 */
export function useCurrencyInfo(currency?: Currency): Maybe<CurrencyInfo>
export function useCurrencyInfo(address?: string, chainId?: InterfaceChainId, skip?: boolean): Maybe<CurrencyInfo>
export function useCurrencyInfo(
  addressOrCurrency?: string | Currency,
  chainId?: InterfaceChainId,
  skip?: boolean,
): Maybe<CurrencyInfo> {
  const { chainId: connectedChainId } = useAccount()
  const chainIdWithFallback =
    (typeof addressOrCurrency === 'string' ? chainId : addressOrCurrency?.chainId) ?? connectedChainId
  const nativeAddressWithFallback =
    UNIVERSE_CHAIN_INFO[chainIdWithFallback as UniverseChainId]?.nativeCurrency.address ??
    UNIVERSE_CHAIN_INFO[UniverseChainId.Mainnet]?.nativeCurrency.address

  const address =
    typeof addressOrCurrency === 'string'
      ? addressOrCurrency === 'ETH'
        ? nativeAddressWithFallback
        : addressOrCurrency
      : addressOrCurrency?.isNative
        ? nativeAddressWithFallback
        : addressOrCurrency?.address

  const supportedChainId = useSupportedChainId(chainIdWithFallback)

  const addressWithFallback =
    address === NATIVE_CHAIN_ID || address === 'ETH' || !address ? nativeAddressWithFallback : address

  const currencyId = buildCurrencyId(supportedChainId ?? UniverseChainId.Mainnet, addressWithFallback)
  const currencyInfo = useUniswapCurrencyInfo(currencyId)

  return useMemo(() => {
    if (!currencyInfo || !addressOrCurrency || skip) {
      return undefined
    }

    return currencyInfo
  }, [addressOrCurrency, currencyInfo, skip])
}

export function useToken(tokenAddress?: string, chainId?: SupportedInterfaceChainId): Maybe<Token> {
  const formattedAddress = isAddress(tokenAddress)
  const { chainId: connectedChainId } = useAccount()
  const currency = useCurrency(formattedAddress ? formattedAddress : undefined, chainId ?? connectedChainId)

  return useMemo(() => {
    if (currency && currency.isToken) {
      return currency
    }
    return undefined
  }, [currency])
}
