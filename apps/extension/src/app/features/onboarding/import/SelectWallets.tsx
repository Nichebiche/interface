import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectWalletsSkeleton } from 'src/app/components/loading/SelectWalletSkeleton'
import { saveDappConnection } from 'src/app/features/dapp/actions'
import { OnboardingScreen } from 'src/app/features/onboarding/OnboardingScreen'
import { useOnboardingSteps } from 'src/app/features/onboarding/OnboardingSteps'
import { Flex, ScrollView, SpinningLoader, Square, Text } from 'ui/src'
import { WalletFilled } from 'ui/src/components/icons'
import { iconSizes } from 'ui/src/theme'
import { UNISWAP_WEB_URL } from 'uniswap/src/constants/urls'
import { FeatureFlags } from 'uniswap/src/features/gating/flags'
import { useFeatureFlag } from 'uniswap/src/features/gating/hooks'
import Trace from 'uniswap/src/features/telemetry/Trace'
import { ExtensionOnboardingFlow, ExtensionOnboardingScreens } from 'uniswap/src/types/screens/extension'
import { useAsyncData } from 'utilities/src/react/hooks'
import WalletPreviewCard from 'wallet/src/components/WalletPreviewCard/WalletPreviewCard'
import { useOnboardingContext } from 'wallet/src/features/onboarding/OnboardingContext'
import { useImportableAccounts } from 'wallet/src/features/onboarding/hooks/useImportableAccounts'
import { useSelectAccounts } from 'wallet/src/features/onboarding/hooks/useSelectAccounts'

export function SelectWallets({ flow }: { flow: ExtensionOnboardingFlow }): JSX.Element {
  const { t } = useTranslation()
  const shouldAutoConnect = useFeatureFlag(FeatureFlags.ExtensionAutoConnect)
  const [buttonClicked, setButtonClicked] = useState(false)

  const { goToNextStep, goToPreviousStep } = useOnboardingSteps()
  const { getGeneratedAddresses, generateAccountsAndImportAddresses } = useOnboardingContext()

  const { data: generatedAddresses } = useAsyncData(getGeneratedAddresses)

  const { importableAccounts, isLoading, showError, refetch } = useImportableAccounts(generatedAddresses)

  const { selectedAddresses, toggleAddressSelection } = useSelectAccounts(importableAccounts)

  const onSubmit = useCallback(async () => {
    setButtonClicked(true)
    const importedAccounts = await generateAccountsAndImportAddresses(selectedAddresses)

    // TODO(EXT-1375): figure out how to better auto connect existing wallets that may have connected via WC or some other method.
    // Once that's solved the feature flag can be turned on/removed.
    if (shouldAutoConnect && importedAccounts?.[0]) {
      await saveDappConnection(UNISWAP_WEB_URL, importedAccounts[0])
    }

    goToNextStep()
    setButtonClicked(false)
  }, [generateAccountsAndImportAddresses, selectedAddresses, goToNextStep, shouldAutoConnect])

  const title = showError ? t('onboarding.selectWallets.title.error') : t('onboarding.selectWallets.title.default')

  return (
    <Trace logImpression properties={{ flow }} screen={ExtensionOnboardingScreens.SelectWallet}>
      <OnboardingScreen
        Icon={
          <Square backgroundColor="$surface2" borderRadius="$rounded12" size={iconSizes.icon48}>
            <WalletFilled color="$neutral1" size={iconSizes.icon24} />
          </Square>
        }
        nextButtonEnabled={showError || (selectedAddresses.length > 0 && !isLoading)}
        nextButtonIcon={buttonClicked ? <SpinningLoader color="$accent1" size={iconSizes.icon20} /> : undefined}
        nextButtonText={
          showError
            ? t('common.button.retry')
            : buttonClicked
              ? t('onboarding.importMnemonic.button.importing')
              : t('common.button.continue')
        }
        nextButtonTheme={showError ? 'secondary' : buttonClicked ? 'accentSecondary' : 'primary'}
        title={title}
        onBack={goToPreviousStep}
        onSubmit={showError ? refetch : onSubmit}
      >
        <ScrollView maxHeight="55vh" my="$spacing32" showsVerticalScrollIndicator={false} width="100%">
          <Flex gap="$spacing12" position="relative" py="$spacing4" width="100%">
            {showError ? (
              <Text color="$statusCritical" textAlign="center" variant="buttonLabel2">
                {t('onboarding.selectWallets.error')}
              </Text>
            ) : !importableAccounts?.length ? (
              <Flex>
                <SelectWalletsSkeleton repeat={3} />
              </Flex>
            ) : (
              importableAccounts?.map((account) => {
                const { ownerAddress, balance } = account
                return (
                  <WalletPreviewCard
                    key={ownerAddress}
                    address={ownerAddress}
                    balance={balance}
                    selected={selectedAddresses.includes(ownerAddress)}
                    onSelect={toggleAddressSelection}
                  />
                )
              })
            )}
          </Flex>
        </ScrollView>
      </OnboardingScreen>
    </Trace>
  )
}
