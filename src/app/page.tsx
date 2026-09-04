import { AppHeader } from "@/components/app-header";
import { DeskApp } from "@/components/desk-app";

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main>
        <DeskApp />
      </main>
    </>
  );
}
