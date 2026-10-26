import { Settings } from "lucide-react";

import { CloudinaryForm } from "@/components/profile/cloudinary-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { StorageModeForm } from "@/components/profile/storage-mode-form";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isCloudinaryConfigured } from "@/lib/cloudinary-credentials";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      storage_mode: true,
      cloudinary_cloud_name: true,
      cloudinary_api_key: true,
      cloudinary_api_secret: true,
    },
  });

  const cloudinaryConfigured = isCloudinaryConfigured(record);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-lede">
          Manage your appearance, sign-in security, file storage, and connected
          services.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[188px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <SettingsNav />
        </aside>

        <div className="space-y-6">
          <section id="appearance" className="scroll-mt-24">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Appearance
                </CardTitle>
                <p className="meta mt-1.5">
                  Choose a theme for this browser. System follows your device
                  setting.
                </p>
              </CardHeader>
              <CardContent>
                <ThemeToggle />
              </CardContent>
            </Card>
          </section>

          <section id="password" className="scroll-mt-24">
            <ProfileForm />
          </section>

          <section id="storage" className="scroll-mt-24">
            <StorageModeForm
              initial={record?.storage_mode ?? "REMOTE"}
              localConfigured={Boolean(process.env.LOCAL_MEDIA_ROOT?.trim())}
              cloudinaryConfigured={cloudinaryConfigured}
            />
          </section>

          <section id="cloudinary" className="scroll-mt-24">
            <CloudinaryForm
              initialCloudName={record?.cloudinary_cloud_name ?? ""}
              initialApiKey={record?.cloudinary_api_key ?? ""}
              configured={cloudinaryConfigured}
              hasSecret={Boolean(record?.cloudinary_api_secret)}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
