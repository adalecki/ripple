import { Route, createBrowserRouter, RouterProvider, createRoutesFromElements } from "react-router-dom";
import Navigation from "./components/Navigation";
import NavbarHeightAdjuster from "./components/NavbarHeightAdjuster";
import Home from "./pages/Home";
import NoPage from "./pages/NoPage";
import EchoTransfer from "./pages/EchoTransfer/EchoTransfer";
import LogDilution from "./pages/LogDilution/components/LogDilution";
import DilutionDesigner from "./pages/DilutionDesigner/DilutionDesigner";
import MobileCheck from "./components/MobileCheck";
import { PreferencesProvider } from "./hooks/usePreferences";

const Layout = () => (
  <PreferencesProvider>
    <MobileCheck>
      <Navigation />
      <NavbarHeightAdjuster />
    </MobileCheck>
  </PreferencesProvider>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route index element={<Home />} />
      <Route path="echotsfr" element={<EchoTransfer />} />
      <Route path="dilutiondesigner" element={<DilutionDesigner />} />
      <Route path="logdilution" element={<LogDilution />} />
      <Route path="*" element={<NoPage />} />
    </Route>
  )
);

function Router() {
  return <RouterProvider router={router} />;
}

export default Router;