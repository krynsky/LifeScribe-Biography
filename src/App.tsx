import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes";
import { ViewModeProvider } from "./lib/view-mode";

export default function App() {
  return (
    <ViewModeProvider>
      <RouterProvider router={router} />
    </ViewModeProvider>
  );
}
