import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DrillDownProvider } from "@/components/DrillDownProvider";
import { useAuth } from "@/hooks/use-auth";
import { Component, ErrorInfo, ReactNode } from "react";
import { UpgradeGate } from "@/components/UpgradeGate";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Kincaid IQ] Unhandled render error:", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f8fafc", fontFamily: "'Inter', system-ui, sans-serif" }}>
          <div style={{ maxWidth: 480, padding: "40px 32px", background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.06)", borderRadius: 20, textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ color: "#0f172a", fontSize: 20, fontWeight: 800, marginBottom: 8,
              fontFamily: "'Crimson Pro', Georgia, serif" }}>Something went wrong</h1>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
              {err.message || "An unexpected error occurred."}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 24 }}>
              If you just refreshed, your browser may have cached an old version. Try a hard refresh.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => window.location.reload()}
                style={{ padding: "10px 20px", borderRadius: 10,
                  background: "linear-gradient(135deg, hsl(349,68%,46%), hsl(349,68%,38%))",
                  border: "none", color: "#0F172A", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(155,28,46,0.2)" }}>
                Reload Page
              </button>
              <button onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
                style={{ padding: "10px 20px", borderRadius: 10, background: "#f1f5f9",
                  border: "1px solid rgba(0,0,0,0.08)", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Portfolio from "@/pages/Portfolio";
import Liquidity from "@/pages/Liquidity";
import PrivateInvestments from "@/pages/PrivateInvestments";
import RealEstate from "@/pages/RealEstate";
import FamilyOffice from "@/pages/FamilyOffice";
import Scenarios from "@/pages/Scenarios";
import Deals from "@/pages/Deals";
import Advisory from "@/pages/Advisory";
import Logs from "@/pages/Logs";
import Login from "@/pages/Login";
import CashFlow from "@/pages/CashFlow";
import Watchlist from "@/pages/Watchlist";
import Vault from "@/pages/Vault";
import TaxHarvest from "@/pages/TaxHarvest";
import MonteCarlo from "@/pages/MonteCarlo";
import CostBasis from "@/pages/CostBasis";
import PME from "@/pages/PME";
import DividendCalendar from "@/pages/DividendCalendar";
import Charitable from "@/pages/Charitable";
import EstatePlanning from "@/pages/EstatePlanning";
import FXHedging from "@/pages/FXHedging";
import RateSensitivity from "@/pages/RateSensitivity";
import AdvisorMessages from "@/pages/AdvisorMessages";
import EntityMap from "@/pages/EntityMap";
import Beneficiaries from "@/pages/Beneficiaries";
import Lifestyle from "@/pages/Lifestyle";
import StaffDirectory from "@/pages/StaffDirectory";
import KeyDates from "@/pages/KeyDates";
import Insurance from "@/pages/Insurance";
import Succession from "@/pages/Succession";
import Foundation from "@/pages/Foundation";
import TaxReturns from "@/pages/TaxReturns";
import AskPortfolio from "@/pages/AskPortfolio";
import MarketBriefing from "@/pages/MarketBriefing";
import DealMemo from "@/pages/DealMemo";
import CapitalCalls from "@/pages/CapitalCalls";
import AlternativesMap from "@/pages/AlternativesMap";
import QuarterlyReport from "@/pages/QuarterlyReport";
import TaxPackage from "@/pages/TaxPackage";
import ClientPackage from "@/pages/ClientPackage";
import RothAnalyzer from "@/pages/RothAnalyzer";
import EducationFund from "@/pages/EducationFund";
import Concierge from "@/pages/Concierge";
import Screener from "@/pages/Screener";
import OptionsAnalytics from "@/pages/OptionsAnalytics";
import EarningsTracker from "@/pages/EarningsTracker";
import Commodities from "@/pages/Commodities";
import Charts from "@/pages/Charts";
import FixedIncome from "@/pages/FixedIncome";
import VolatilityMonitor from "@/pages/VolatilityMonitor";
import EconomicDashboard from "@/pages/EconomicDashboard";
import CompanyDeepDive from "@/pages/CompanyDeepDive";
import NewsIntelligence from "@/pages/NewsIntelligence";
import FactorAnalysis from "@/pages/FactorAnalysis";
import CreditMonitor from "@/pages/CreditMonitor";
import BloombergHub from "@/pages/BloombergHub";
import DataIntelligence from "@/pages/DataIntelligence";
import LiveFeeds from "@/pages/LiveFeeds";
import ExecutiveWarRoom from "@/pages/ExecutiveWarRoom";
import TechStack from "@/pages/TechStack";
import AdminView from "@/pages/AdminView";
import GovernanceEngine from "@/pages/GovernanceEngine";
import KPILibrary from "@/pages/KPILibrary";
import ExecutiveTiles from "@/pages/ExecutiveTiles";
import ClaimReceipt from "@/pages/ClaimReceipt";
import BoardPack from "@/pages/BoardPack";
import PolicyCheck from "@/pages/PolicyCheck";
import ReceiptCheck from "@/pages/ReceiptCheck";
import ClaimVerification from "@/pages/ClaimVerification";
import ExportGeneration from "@/pages/ExportGeneration";
import AuditLog from "@/pages/AuditLog";
import DatabaseExplorer from "@/pages/DatabaseExplorer";
import PipelineIntelligence from "@/pages/PipelineIntelligence";
import BrokerProspects from "@/pages/BrokerProspects";
import CrossIntelligence from "@/pages/CrossIntelligence";
import CommitEngine from "@/pages/CommitEngine";
import MADiligence from "@/pages/MADiligence";
import BusinessValuation from "@/pages/BusinessValuation";
import ActuarialBroker from "@/pages/ActuarialBroker";
import Landing, { SolutionsPage, CapitalLibraryPage, FamilyOfficesPage, ContactPage } from "@/pages/Landing";
import Demo from "@/pages/Demo";
import Signup from "@/pages/Signup";
import ShareResolver from "@/pages/ShareResolver";
import ShareLinks from "@/pages/ShareLinks";
import VerifyPackagePublic from "@/pages/VerifyPackagePublic";
import Onboarding from "@/pages/Onboarding";
import Billing from "@/pages/Billing";
import Pricing from "@/pages/Pricing";
import SaasFiduciary from "@/pages/SaasFiduciary";
import SaasBroker from "@/pages/SaasBroker";
import SalesOS, { SalesOSAccountDetail } from "@/pages/SalesOS";
import OpportunityOS from "@/pages/OpportunityOS";
import SaasStopLoss from "@/pages/SaasStopLoss";
import SaasNetwork from "@/pages/SaasNetwork";
import NetworkIQ from "@/pages/NetworkIQ";
import FiduciaryIQ from "@/pages/FiduciaryIQ";
import StewardshipBuilder from "@/pages/StewardshipBuilder";
import EmployerHealthScore from "@/pages/EmployerHealthScore";
import ClaimsRecovery from "@/pages/ClaimsRecovery";
import HealthcareIntelligenceOS from "@/pages/HealthcareIntelligenceOS";
import NetworkDisruptionReport from "@/pages/NetworkDisruptionReport";
import ContractXRay from "@/pages/ContractXRay";
import RxDefense from "@/pages/RxDefense";
import TpaIq from "@/pages/TpaIq";
import ShadyBrokerIndex from "@/pages/ShadyBrokerIndex";
import SbiLanding from "@/pages/SbiLanding";
import SbiBrokerProfile from "@/pages/SbiBrokerProfile";
import StopLoss from "@/pages/StopLoss";
import CfoWarRoom from "@/pages/CfoWarRoom";
import M365Integration from "@/pages/M365Integration";
import QuickBooksIntegration from "@/pages/QuickBooksIntegration";
import IntegrationsHub from "@/pages/IntegrationsHub";
import GovernanceWarRoom from "@/pages/GovernanceWarRoom";
import GovernanceClaims from "@/pages/GovernanceClaims";
import GovernanceDossier from "@/pages/GovernanceDossier";
import DrillEngine from "@/pages/DrillEngine";
import DrillEbitda from "@/pages/DrillEbitda";
import DrillProvider from "@/pages/DrillProvider";
import DrillCompliance from "@/pages/DrillCompliance";
import DrillYoY from "@/pages/DrillYoY";
import DrillPension from "@/pages/DrillPension";
import ActuarialEngineIQ from "@/pages/ActuarialEngineIQ";
import GlpStressTest from "@/pages/GlpStressTest";
import GodMode from "@/pages/GodMode";
import SbiForensic from "@/pages/SbiForensic";
import CeiEngine from "@/pages/CeiEngine";
import CapitalVelocity from "@/pages/CapitalVelocity";
import LcncSecurity from "@/pages/LcncSecurity";
import McKinseyCoPilot from "@/pages/McKinseyCoPilot";
import McKinseyFloatingCoPilot from "@/components/McKinseyFloatingCoPilot";
import SMSCenter from "@/pages/SMSCenter";
import ComplianceEngine from "@/pages/ComplianceEngine";
import BenefitsBenchmarking from "@/pages/BenefitsBenchmarking";
import RxPBM from "@/pages/RxPBM";
import RxDefensePro from "@/pages/RxDefensePro";
import ActuarialWorkbench from "@/pages/ActuarialWorkbench";
import Indiana5500Upload from "@/pages/Indiana5500Upload";
import ContactIntelligence from "@/pages/ContactIntelligence";
import ContactsDatabase from "@/pages/ContactsDatabase";
import CrmSync from "@/pages/CrmSync";
import EdgarIntelligence from "@/pages/EdgarIntelligence";
import SalesIQModule from "@/pages/SalesIQModule";
import AccountIntelHub from "@/pages/AccountIntelHub";
import FederalIntelligence from "@/pages/FederalIntelligence";
import RxIntelligence from "@/pages/RxIntelligence";
import MarketIntelligence from "@/pages/MarketIntelligence";
import KiqEngine from "@/pages/KiqEngine";
import MeetingIntelligence from "@/pages/MeetingIntelligence";
import GovStatsHub from "@/pages/GovStatsHub";
import RfpOS from "@/pages/RfpOS";
import DigestPreferences from "@/pages/DigestPreferences";
import RfpBoard from "@/pages/RfpBoard";
import RfpIntelligenceOS from "@/pages/RfpIntelligenceOS";
import Form5500Monitor from "@/pages/Form5500Monitor";
import RfpResourceAllocator from "@/pages/RfpResourceAllocator";
import BattleCards from "@/pages/BattleCards";
import RfpCommandCenter from "@/pages/RfpCommandCenter";
import RfpModelHealth from "@/pages/RfpModelHealth";
import PlanMetricsLab from "@/pages/PlanMetricsLab";
import EnterpriseCommandCenter from "@/pages/EnterpriseCommandCenter";
import EnterpriseReadinessAudit from "@/pages/EnterpriseReadinessAudit";
import KiqVerify from "@/pages/KiqVerify";
import OperatingSystems, { OperatingSystemDetail } from "@/pages/OperatingSystems";
import EngineCatalog, { EngineDetail } from "@/pages/Engines";
import Company360 from "@/pages/Company360";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element | null }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl animate-pulse" style={{ background: "rgba(0,168,255,0.3)" }} />
          <p className="text-sm text-muted-foreground">Loading Kincaid IQ…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/auth");
    return <></>;
  }

  return <Component />;
}

function GatedRoute({ component: Component, module }: { component: () => JSX.Element | null; module: string }) {
  return (
    <ProtectedRoute component={() => (
      <UpgradeGate module={module}>
        <Component />
      </UpgradeGate>
    )} />
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  return (
    <Switch>
      <Route path="/auth">
        {() => {
          if (!isLoading && isAuthenticated) {
            navigate("/");
            return null;
          }
          return <Login />;
        }}
      </Route>
      <Route path="/">{() => <ProtectedRoute component={CfoWarRoom} />}</Route>
      <Route path="/kiq-verify">{() => <ProtectedRoute component={KiqVerify} />}</Route>
      <Route path="/engines">{() => <ProtectedRoute component={EngineCatalog} />}</Route>
      <Route path="/engines/:slug">{() => <ProtectedRoute component={EngineDetail} />}</Route>
      <Route path="/operating-systems">{() => <ProtectedRoute component={OperatingSystems} />}</Route>
      <Route path="/operating-systems/:key">{() => <ProtectedRoute component={OperatingSystemDetail} />}</Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/portfolio">{() => <ProtectedRoute component={Portfolio} />}</Route>
      <Route path="/liquidity">{() => <ProtectedRoute component={Liquidity} />}</Route>
      <Route path="/private-investments">{() => <ProtectedRoute component={PrivateInvestments} />}</Route>
      <Route path="/real-estate">{() => <ProtectedRoute component={RealEstate} />}</Route>
      <Route path="/family-office">{() => <ProtectedRoute component={FamilyOffice} />}</Route>
      <Route path="/entity-map">{() => <ProtectedRoute component={EntityMap} />}</Route>
      <Route path="/beneficiaries">{() => <ProtectedRoute component={Beneficiaries} />}</Route>
      <Route path="/lifestyle">{() => <ProtectedRoute component={Lifestyle} />}</Route>
      <Route path="/staff-directory">{() => <ProtectedRoute component={StaffDirectory} />}</Route>
      <Route path="/key-dates">{() => <ProtectedRoute component={KeyDates} />}</Route>
      <Route path="/insurance">{() => <ProtectedRoute component={Insurance} />}</Route>
      <Route path="/succession">{() => <ProtectedRoute component={Succession} />}</Route>
      <Route path="/foundation">{() => <ProtectedRoute component={Foundation} />}</Route>
      <Route path="/scenarios">{() => <ProtectedRoute component={Scenarios} />}</Route>
      <Route path="/deals">{() => <ProtectedRoute component={Deals} />}</Route>
      <Route path="/cash-flow">{() => <ProtectedRoute component={CashFlow} />}</Route>
      <Route path="/watchlist">{() => <ProtectedRoute component={Watchlist} />}</Route>
      <Route path="/vault">{() => <ProtectedRoute component={Vault} />}</Route>
      <Route path="/advisory">{() => <ProtectedRoute component={Advisory} />}</Route>
      <Route path="/logs">{() => <ProtectedRoute component={Logs} />}</Route>
      <Route path="/tax-returns">{() => <ProtectedRoute component={TaxReturns} />}</Route>
      <Route path="/tax-harvest">{() => <ProtectedRoute component={TaxHarvest} />}</Route>
      <Route path="/monte-carlo">{() => <ProtectedRoute component={MonteCarlo} />}</Route>
      <Route path="/cost-basis">{() => <ProtectedRoute component={CostBasis} />}</Route>
      <Route path="/pme">{() => <ProtectedRoute component={PME} />}</Route>
      <Route path="/dividend-calendar">{() => <ProtectedRoute component={DividendCalendar} />}</Route>
      <Route path="/charitable">{() => <ProtectedRoute component={Charitable} />}</Route>
      <Route path="/estate-planning">{() => <ProtectedRoute component={EstatePlanning} />}</Route>
      <Route path="/fx-hedging">{() => <ProtectedRoute component={FXHedging} />}</Route>
      <Route path="/rate-sensitivity">{() => <ProtectedRoute component={RateSensitivity} />}</Route>
      <Route path="/advisor-messages">{() => <ProtectedRoute component={AdvisorMessages} />}</Route>
      <Route path="/ask-portfolio">{() => <ProtectedRoute component={AskPortfolio} />}</Route>
      <Route path="/market-briefing">{() => <ProtectedRoute component={MarketBriefing} />}</Route>
      <Route path="/deal-memo">{() => <ProtectedRoute component={DealMemo} />}</Route>
      <Route path="/capital-calls">{() => <ProtectedRoute component={CapitalCalls} />}</Route>
      <Route path="/alternatives-map">{() => <ProtectedRoute component={AlternativesMap} />}</Route>
      <Route path="/quarterly-report">{() => <ProtectedRoute component={QuarterlyReport} />}</Route>
      <Route path="/tax-package">{() => <ProtectedRoute component={TaxPackage} />}</Route>
      <Route path="/client-package">{() => <ProtectedRoute component={ClientPackage} />}</Route>
      <Route path="/roth-analyzer">{() => <ProtectedRoute component={RothAnalyzer} />}</Route>
      <Route path="/education-fund">{() => <ProtectedRoute component={EducationFund} />}</Route>
      <Route path="/concierge">{() => <ProtectedRoute component={Concierge} />}</Route>
      <Route path="/charts">{() => <ProtectedRoute component={Charts} />}</Route>
      <Route path="/screener">{() => <ProtectedRoute component={Screener} />}</Route>
      <Route path="/options">{() => <ProtectedRoute component={OptionsAnalytics} />}</Route>
      <Route path="/earnings">{() => <ProtectedRoute component={EarningsTracker} />}</Route>
      <Route path="/commodities">{() => <ProtectedRoute component={Commodities} />}</Route>
      <Route path="/fixed-income">{() => <ProtectedRoute component={FixedIncome} />}</Route>
      <Route path="/volatility">{() => <ProtectedRoute component={VolatilityMonitor} />}</Route>
      <Route path="/economic-data">{() => <ProtectedRoute component={EconomicDashboard} />}</Route>
      <Route path="/company">{() => <ProtectedRoute component={CompanyDeepDive} />}</Route>
      <Route path="/news">{() => <ProtectedRoute component={NewsIntelligence} />}</Route>
      <Route path="/factor-analysis">{() => <ProtectedRoute component={FactorAnalysis} />}</Route>
      <Route path="/credit">{() => <ProtectedRoute component={CreditMonitor} />}</Route>
      <Route path="/bloomberg">{() => <ProtectedRoute component={BloombergHub} />}</Route>
      <Route path="/data-feeds">{() => <ProtectedRoute component={DataIntelligence} />}</Route>
      <Route path="/live-feeds">{() => <ProtectedRoute component={LiveFeeds} />}</Route>
      <Route path="/war-room">{() => <ProtectedRoute component={CfoWarRoom} />}</Route>
      <Route path="/tech-stack">{() => <ProtectedRoute component={TechStack} />}</Route>
      <Route path="/admin">{() => <ProtectedRoute component={AdminView} />}</Route>
      <Route path="/governance">{() => <ProtectedRoute component={GovernanceEngine} />}</Route>
      <Route path="/kpi-library">{() => <ProtectedRoute component={KPILibrary} />}</Route>
      <Route path="/executive-tiles">{() => <ProtectedRoute component={ExecutiveTiles} />}</Route>
      <Route path="/receipts/:claimId">{() => <ProtectedRoute component={ClaimReceipt} />}</Route>
      <Route path="/board-pack">{() => <ProtectedRoute component={BoardPack} />}</Route>
      <Route path="/policy-check">{() => <ProtectedRoute component={PolicyCheck} />}</Route>
      <Route path="/receipt-check">{() => <ProtectedRoute component={ReceiptCheck} />}</Route>
      <Route path="/claim-verification">{() => <ProtectedRoute component={ClaimVerification} />}</Route>
      <Route path="/export-generation">{() => <ProtectedRoute component={ExportGeneration} />}</Route>
      <Route path="/audit-log">{() => <ProtectedRoute component={AuditLog} />}</Route>
      <Route path="/database">{() => <ProtectedRoute component={DatabaseExplorer} />}</Route>
      <Route path="/pipeline">{() => <GatedRoute component={PipelineIntelligence} module="prospecting" />}</Route>
      <Route path="/broker-prospects">{() => <GatedRoute component={BrokerProspects} module="prospecting" />}</Route>
      <Route path="/cross-intel">{() => <ProtectedRoute component={CrossIntelligence} />}</Route>
      <Route path="/commit-engine">{() => <ProtectedRoute component={CommitEngine} />}</Route>
      <Route path="/ma-diligence">{() => <ProtectedRoute component={MADiligence} />}</Route>
      <Route path="/valuation">{() => <ProtectedRoute component={BusinessValuation} />}</Route>
      <Route path="/governance-war-room">{() => <ProtectedRoute component={GovernanceWarRoom} />}</Route>
      <Route path="/governance-claims">{() => <ProtectedRoute component={GovernanceClaims} />}</Route>
      <Route path="/governance-dossier">{() => <ProtectedRoute component={GovernanceDossier} />}</Route>
      <Route path="/drill/ebitda">{() => <ProtectedRoute component={DrillEbitda} />}</Route>
      <Route path="/drill/provider">{() => <ProtectedRoute component={DrillProvider} />}</Route>
      <Route path="/drill/compliance">{() => <ProtectedRoute component={DrillCompliance} />}</Route>
      <Route path="/drill/yoy">{() => <ProtectedRoute component={DrillYoY} />}</Route>
      <Route path="/drill/pension">{() => <ProtectedRoute component={DrillPension} />}</Route>
      <Route path="/actuarial-broker">{() => <GatedRoute component={ActuarialBroker} module="actuarial-engine" />}</Route>
      <Route path="/actuarial-engine">{() => <GatedRoute component={ActuarialEngineIQ} module="actuarial-engine" />}</Route>
      <Route path="/glp1-stress-test">{() => <GatedRoute component={GlpStressTest} module="glp1-stress-test" />}</Route>
      <Route path="/god-mode">{() => <GatedRoute component={GodMode} module="god-mode" />}</Route>
      <Route path="/sbi-forensic">{() => <GatedRoute component={SbiForensic} module="sbi-forensic" />}</Route>
      <Route path="/cei-engine">{() => <GatedRoute component={CeiEngine} module="cei-engine" />}</Route>
      <Route path="/capital-velocity">{() => <ProtectedRoute component={CapitalVelocity} />}</Route>
      <Route path="/lcnc-security">{() => <ProtectedRoute component={LcncSecurity} />}</Route>
      <Route path="/mckinsey-copilot">{() => <GatedRoute component={McKinseyCoPilot} module="mckinsey-copilot" />}</Route>
      <Route path="/sms-center">{() => <GatedRoute component={SMSCenter} module="sms-center" />}</Route>
      <Route path="/compliance-engine">{() => <ProtectedRoute component={ComplianceEngine} />}</Route>
      <Route path="/benefits-benchmarking">{() => <ProtectedRoute component={BenefitsBenchmarking} />}</Route>
      <Route path="/company-360">{() => <ProtectedRoute component={Company360} />}</Route>
      <Route path="/company-360/:ein">{() => <ProtectedRoute component={Company360} />}</Route>
      <Route path="/gov-stats">{() => <ProtectedRoute component={GovStatsHub} />}</Route>
      {/* SaaS — public pages */}
      <Route path="/landing">{() => <Landing />}</Route>
      <Route path="/solutions">{() => <SolutionsPage />}</Route>
      <Route path="/capital-library">{() => <CapitalLibraryPage />}</Route>
      <Route path="/family-offices">{() => <FamilyOfficesPage />}</Route>
      <Route path="/contact">{() => <ContactPage />}</Route>
      <Route path="/demo">{() => <Demo />}</Route>
      <Route path="/signup">
        {() => {
          if (!isLoading && isAuthenticated) {
            navigate("/");
            return null;
          }
          return <Signup />;
        }}
      </Route>
      <Route path="/verify">{() => <VerifyPackagePublic />}</Route>
      <Route path="/onboarding">{() => <Onboarding />}</Route>
      {/* SaaS — authenticated pages */}
      <Route path="/billing">{() => <ProtectedRoute component={Billing} />}</Route>
      <Route path="/pricing">{() => <ProtectedRoute component={Pricing} />}</Route>
      <Route path="/saas/fiduciary">{() => <ProtectedRoute component={SaasFiduciary} />}</Route>
      <Route path="/saas/broker">{() => <ProtectedRoute component={SaasBroker} />}</Route>
      <Route path="/saas/stoploss">{() => <ProtectedRoute component={SaasStopLoss} />}</Route>
      <Route path="/saas/network">{() => <ProtectedRoute component={SaasNetwork} />}</Route>
      <Route path="/network-iq">{() => <ProtectedRoute component={NetworkIQ} />}</Route>
      <Route path="/fiduciary-iq">{() => <ProtectedRoute component={FiduciaryIQ} />}</Route>
      <Route path="/stewardship">{() => <ProtectedRoute component={StewardshipBuilder} />}</Route>
      <Route path="/employer-health-score">{() => <ProtectedRoute component={EmployerHealthScore} />}</Route>
      <Route path="/claims-recovery">{() => <ProtectedRoute component={ClaimsRecovery} />}</Route>
      <Route path="/hios">{() => <ProtectedRoute component={HealthcareIntelligenceOS} />}</Route>
      <Route path="/network-iq/disruption-report">{() => <ProtectedRoute component={NetworkDisruptionReport} />}</Route>
      <Route path="/saas/contract-xray">{() => <ProtectedRoute component={ContractXRay} />}</Route>
      <Route path="/rx-pbm">{() => <ProtectedRoute component={RxPBM} />}</Route>
      <Route path="/actuarial-workbench">{() => <ProtectedRoute component={ActuarialWorkbench} />}</Route>
      <Route path="/indiana-5500-upload">{() => <ProtectedRoute component={Indiana5500Upload} />}</Route>
      <Route path="/contact-intel">{() => <ProtectedRoute component={ContactIntelligence} />}</Route>
      <Route path="/contacts-db">{() => <ProtectedRoute component={ContactsDatabase} />}</Route>
      <Route path="/crm-sync">{() => <ProtectedRoute component={CrmSync} />}</Route>
      <Route path="/edgar-intelligence">{() => <ProtectedRoute component={EdgarIntelligence} />}</Route>
      <Route path="/sales-iq-intel">{() => <ProtectedRoute component={SalesIQModule} />}</Route>
      <Route path="/account-intel">{() => <ProtectedRoute component={AccountIntelHub} />}</Route>
      <Route path="/federal-intelligence">{() => <ProtectedRoute component={FederalIntelligence} />}</Route>
      <Route path="/rx-intelligence">{() => <ProtectedRoute component={RxIntelligence} />}</Route>
      <Route path="/market-intelligence">{() => <ProtectedRoute component={MarketIntelligence} />}</Route>
      <Route path="/kiq-engine">{() => <ProtectedRoute component={KiqEngine} />}</Route>
      <Route path="/meeting-notes">{() => <ProtectedRoute component={MeetingIntelligence} />}</Route>
      <Route path="/drill-engine">{() => <ProtectedRoute component={DrillEngine} />}</Route>
      <Route path="/rfp-os">{() => <ProtectedRoute component={RfpOS} />}</Route>
      <Route path="/rfp-os/:tab">{() => <ProtectedRoute component={RfpOS} />}</Route>
      <Route path="/rfp-board">{() => <ProtectedRoute component={RfpBoard} />}</Route>
      <Route path="/digest-preferences">{() => <ProtectedRoute component={DigestPreferences} />}</Route>
      <Route path="/5500-monitor">{() => <ProtectedRoute component={Form5500Monitor} />}</Route>
      <Route path="/rfp-resource-allocator">{() => <ProtectedRoute component={RfpResourceAllocator} />}</Route>
      <Route path="/battlecards">{() => <ProtectedRoute component={BattleCards} />}</Route>
      <Route path="/enterprise-command-center">{() => <ProtectedRoute component={EnterpriseCommandCenter} />}</Route>
      <Route path="/enterprise-readiness-audit">{() => <ProtectedRoute component={EnterpriseReadinessAudit} />}</Route>
      <Route path="/sales-os">{() => <ProtectedRoute component={SalesOS} />}</Route>
      <Route path="/opportunity-os">{() => <ProtectedRoute component={OpportunityOS} />}</Route>
      <Route path="/sales-os/prospects">{() => <ProtectedRoute component={SalesOS} />}</Route>
      <Route path="/sales-os/pipeline">{() => <ProtectedRoute component={SalesOS} />}</Route>
      <Route path="/sales-os/alerts">{() => <ProtectedRoute component={SalesOS} />}</Route>
      <Route path="/sales-os/analytics">{() => <ProtectedRoute component={SalesOS} />}</Route>
      <Route path="/sales-os/account/:ein">{() => <ProtectedRoute component={SalesOSAccountDetail} />}</Route>
      <Route path="/rfp-intelligence">{() => <GatedRoute component={RfpIntelligenceOS} module="rfp-intelligence" />}</Route>
      <Route path="/rfp-command-center">{() => <ProtectedRoute component={RfpCommandCenter} />}</Route>
      <Route path="/rfp-model-health">{() => <ProtectedRoute component={RfpModelHealth} />}</Route>
      <Route path="/plan-metrics">{() => <ProtectedRoute component={PlanMetricsLab} />}</Route>
      <Route path="/rx-defense">{() => <GatedRoute component={RxDefense} module="rx-defense" />}</Route>
      <Route path="/tpa-iq">{() => <ProtectedRoute component={TpaIq} />}</Route>
      <Route path="/shady-broker-index">{() => <ProtectedRoute component={ShadyBrokerIndex} />}</Route>
      <Route path="/s/:shortId">{() => <ShareResolver />}</Route>
      <Route path="/share-links">{() => <ProtectedRoute component={ShareLinks} />}</Route>
      <Route path="/sbi">{() => <SbiLanding />}</Route>
      <Route path="/sbi/broker/:slug">{() => <SbiBrokerProfile />}</Route>
      <Route path="/rx-defense-pro">{() => <ProtectedRoute component={RxDefensePro} />}</Route>
      <Route path="/stop-loss">{() => <ProtectedRoute component={StopLoss} />}</Route>
      <Route path="/cfo-war-room">{() => <ProtectedRoute component={ExecutiveWarRoom} />}</Route>
      <Route path="/integrations">{() => <ProtectedRoute component={IntegrationsHub} />}</Route>
      <Route path="/integrations/m365">{() => <ProtectedRoute component={M365Integration} />}</Route>
      <Route path="/integrations/quickbooks">{() => <ProtectedRoute component={QuickBooksIntegration} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DrillDownProvider>
            <Toaster />
            <Router />
            <McKinseyFloatingCoPilot />
          </DrillDownProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
