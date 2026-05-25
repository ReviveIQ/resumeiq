import { Switch, Route } from "wouter";
import ResumeIQ from "./pages/ResumeIQ";
import PipelineTracker from "./pages/PipelineTracker";
import StripeDashboard from "./pages/StripeDashboard";

export default function App() {
  return (
    <Switch>
      <Route path="/admin/pipeline" component={PipelineTracker} />
      <Route path="/admin/stripe" component={StripeDashboard} />
      <Route component={ResumeIQ} />
    </Switch>
  );
}
