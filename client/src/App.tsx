import { Switch, Route } from "wouter";
import { useEffect } from "react";
import ResumeIQ from "./pages/ResumeIQ";
import LandingPage from "./pages/LandingPage";
import PipelineTracker from "./pages/PipelineTracker";
import StripeDashboard from "./pages/StripeDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import { trackEvent } from "./tracking";

export default function App() {
  useEffect(() => {
    trackEvent('page_view', { path: window.location.pathname });
  }, []);

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/app" component={ResumeIQ} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/admin/pipeline" component={PipelineTracker} />
      <Route path="/admin/stripe" component={StripeDashboard} />
    </Switch>
  );
}
