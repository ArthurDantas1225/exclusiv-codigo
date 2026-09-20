import { Provider } from "@/components/provider";
import { Shell } from "@/components/shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      <Shell>{children}</Shell>
    </Provider>
  );
}
