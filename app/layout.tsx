import "./globals.css";
import type {Metadata} from "next";
export const metadata:Metadata={title:"Football Value Index",description:"European football results versus squad market value"};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
