import { notFound } from "next/navigation";
import { ControllerPreview } from "@/components/create-controller/preview";

const Page = () => {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <ControllerPreview />;
};

export default Page;
