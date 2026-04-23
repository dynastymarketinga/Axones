"use client"

import { EllipsisVertical, UserIcon, CreditCardIcon, SettingsIcon, LogOutIcon, Users, DollarSign, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"

export default function WebsiteAnalytics() {
    return (
        <div className="analytics-overview">
            <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl mb-1">Website Analytics</CardTitle>
                        <CardDescription>
                            Overview of your website analytics data
                        </CardDescription>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full [&_svg]:size-5">
                                <EllipsisVertical />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>
                                <UserIcon />
                                View detailed report
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <CreditCardIcon />
                                Download report
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <SettingsIcon />
                                Export as CSV / PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <LogOutIcon />
                                Refresh data
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent>
                    <div className="mt-6">
                        {/* Top stats */}
                        <div className="stats-details">
                            <h2 className="text-4xl font-semibold">685.7K</h2>
                            <p className="text-muted-foreground">Total Users</p>
                        </div>

                        {/* Metrics */}
                        <div className="mt-6 flex flex-col gap-6">

                            {/* Revenue */}
                            <div className="flex items-center gap-5">
                                <div className="
                                    flex h-11 w-11 items-center justify-center rounded-xl
                                    bg-emerald-100 text-emerald-600
                                    flex-shrink-0
                                    dark:border dark:border-emerald-500/20
                                    dark:text-emerald-400
                                    dark:bg-emerald-500/10
                                    "
                                >
                                    <DollarSign className="h-6 w-6" />
                                </div>

                                <div className="w-full">
                                    <div className="flex items-center justify-between">
                                        <span className="text-md text-muted-foreground">Revenue</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">$7,926</span>
                                            <span className="flex items-center text-sm text-emerald-600">
                                                <TrendingUp className="mr-1 h-4 w-4" />
                                                12%
                                            </span>
                                        </div>
                                    </div>

                                    <Progress
                                        value={60}
                                        className="mt-2 h-2 bg-muted 
                                        [&>div]:bg-[linear-gradient(310deg,#17ad37,#98ec2d)] 
                                        [&>div]:rounded-full"
                                    />
                                </div>
                            </div>

                            {/* Active Users */}
                            <div className="flex items-center gap-5">
                                <div className="
                                    flex h-11 w-11 items-center justify-center rounded-xl
                                    bg-rose-100 text-rose-600
                                    flex-shrink-0
                                    dark:border dark:border-rose-500/20
                                    dark:text-rose-400
                                    dark:bg-rose-500/10
                                    "
                                >
                                    <Users className="h-6 w-6" />
                                </div>

                                <div className="w-full">
                                    <div className="flex items-center justify-between">
                                        <span className="text-md text-muted-foreground">Active Users</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">428</span>
                                            <span className="flex items-center text-sm text-emerald-600">
                                                <TrendingUp className="mr-1 h-4 w-4" />
                                                8%
                                            </span>
                                        </div>
                                    </div>

                                    <Progress
                                        value={60}
                                        className="mt-2 h-2 bg-muted 
                                        [&>div]:bg-[linear-gradient(310deg,#ee0979,#ff6a00)] 
                                        [&>div]:rounded-full"
                                    />
                                </div>
                            </div>

                            {/* Conversion Rate */}
                            <div className="flex items-center gap-5">
                                <div className="
                                    flex h-11 w-11 items-center justify-center rounded-xl
                                    bg-violet-100 text-violet-600
                                    flex-shrink-0
                                    dark:border dark:border-violet-500/20
                                    dark:text-violet-400
                                    dark:bg-violet-500/10
                                    "
                                >
                                    <TrendingUp className="h-6 w-6" />
                                </div>

                                <div className="w-full">
                                    <div className="flex items-center justify-between">
                                        <span className="text-md text-muted-foreground">Conversion Rate</span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">3.6%</span>
                                            <span className="flex items-center text-sm text-rose-500">
                                                <TrendingDown className="mr-1 h-4 w-4" />
                                                2%
                                            </span>
                                        </div>
                                    </div>

                                    <Progress
                                        value={60}
                                        className="mt-2 h-2 bg-muted 
                                        [&>div]:bg-[linear-gradient(310deg,#7928ca,#ff0080)] 
                                        [&>div]:rounded-full"
                                    />
                                </div>
                            </div>

                        </div>
                    </div>
                </CardContent>

            </Card>
        </div>
    )
}