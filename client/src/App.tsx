import { Switch, Route } from "wouter";
import ResumeIQ from "./pages/ResumeIQ";
import LandingPage from "./pages/LandingPage";
import PipelineTracker from "./pages/PipelineTracker";
import StripeDashboard from "./pages/StripeDashboard";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/app" component={ResumeIQ} />
      <Route path="/admin/pipeline" component={PipelineTracker} />
      <Route path="/admin/stripe" component={StripeDashboard} />
    </Switch>
  );
}
