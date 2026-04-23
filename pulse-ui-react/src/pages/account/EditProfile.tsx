"use client"

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export default function EditProfile() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-4xl p-8">

        <h2 className="text-xl font-semibold mb-6">
          Edit Profile
        </h2>

        <Tabs defaultValue="profile" className="w-full">

          {/* Tabs Header */}
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </TabsList>

          {/* ================= PROFILE TAB ================= */}
          <TabsContent value="profile" className="space-y-6">

            <div className="flex items-center gap-6 flex-wrap">
              <img
                src="https://randomuser.me/api/portraits/men/32.jpg"
                className="w-28 h-28 rounded-full shadow-md"
              />
              <div>
                <Button variant="outline" className="rounded-full px-6">
                  Upload new image
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  1200x1200 px • PNG or JPG
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input placeholder="Username or email" />
              </div>

              <div>
                <Label>Location</Label>
                <Input placeholder="City, Country" />
              </div>

              <div>
                <Label>Bio</Label>
                <Textarea
                  placeholder="Write something about yourself..."
                  className="min-h-[120px]"
                />
              </div>
            </div>

            <Button className="rounded-full px-6">
              Save Profile
            </Button>

          </TabsContent>

          {/* ================= SECURITY TAB ================= */}
          <TabsContent value="security" className="space-y-6">

            <div className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input type="password" />
              </div>

              <div>
                <Label>New Password</Label>
                <Input type="password" />
              </div>

              <div>
                <Label>Confirm Password</Label>
                <Input type="password" />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-xl p-4">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add extra security to your account
                </p>
              </div>
              <Switch />
            </div>

            <Button className="rounded-full px-6">
              Update Security
            </Button>

          </TabsContent>

          {/* ================= SOCIAL TAB ================= */}
          <TabsContent value="social" className="space-y-6">

            <div className="flex items-center justify-between border rounded-xl p-4">
              <span className="font-medium">Facebook</span>
              <Switch />
            </div>

            <div className="flex items-center justify-between border rounded-xl p-4">
              <span className="font-medium">Twitter</span>
              <Switch />
            </div>

            <div className="flex items-center justify-between border rounded-xl p-4">
              <span className="font-medium">Instagram</span>
              <Switch />
            </div>

            <div className="flex items-center justify-between border rounded-xl p-4">
              <span className="font-medium">LinkedIn</span>
              <Switch />
            </div>

            <Button className="rounded-full px-6">
              Save Social Settings
            </Button>

          </TabsContent>

        </Tabs>
      </Card>
    </div>
  )
}