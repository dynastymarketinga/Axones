
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { Airplay, ChartColumnDecreasing, Clock, Lightbulb, TrendingDown, TrendingUp, UserPlus, UserRoundX, Wallet } from "lucide-react"
import { Progress } from "@/components/ui/progress"

export default function TopTrafficChannelsCard() {

    return (
        <Card>
            <CardHeader className="space-y-0">
                <CardTitle className="text-lg">Top Traffic Channels</CardTitle>
                <CardDescription>Based on visitor data</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="flex flex-col gap-6">

                    {/* Revenue */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-emerald-100 text-emerald-600
        flex-shrink-0
        dark:border dark:border-emerald-500/20
        dark:text-emerald-400
        dark:bg-emerald-500/10
      ">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Revenue</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">$7,926</span>
                                    <span className="flex items-center text-sm text-emerald-600">
                                        <TrendingUp className="mr-1 h-4 w-4" />12%
                                    </span>
                                </div>
                            </div>
                            <Progress value={60} className="mt-2 h-1.5 bg-muted [&>div]:bg-emerald-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* Active Users */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-indigo-100 text-indigo-600
        flex-shrink-0
        dark:border dark:border-indigo-500/20
        dark:text-indigo-400
        dark:bg-indigo-500/10
      ">
                            <UserRoundX className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Active Users</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">428</span>
                                    <span className="flex items-center text-sm text-indigo-600">
                                        <TrendingUp className="mr-1 h-4 w-4" />8%
                                    </span>
                                </div>
                            </div>
                            <Progress value={75} className="mt-2 h-1.5 bg-muted [&>div]:bg-indigo-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* Bounce Rate */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-pink-100 text-pink-600
        flex-shrink-0
        dark:border dark:border-pink-500/20
        dark:text-pink-400
        dark:bg-pink-500/10
      ">
                            <Lightbulb className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Bounce Rate</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">42%</span>
                                    <span className="flex items-center text-sm text-green-500">
                                        <TrendingUp className="mr-1 h-4 w-4" />5%
                                    </span>
                                </div>
                            </div>
                            <Progress value={42} className="mt-2 h-1.5 bg-muted [&>div]:bg-pink-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* Customer Retention */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-teal-100 text-teal-600
        flex-shrink-0
        dark:border dark:border-teal-500/20
        dark:text-teal-400
        dark:bg-teal-500/10
      ">
                            <Airplay className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Customer Retention</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">78%</span>
                                    <span className="flex items-center text-sm text-teal-500">
                                        <TrendingUp className="mr-1 h-4 w-4" />3%
                                    </span>
                                </div>
                            </div>
                            <Progress value={78} className="mt-2 h-1.5 bg-muted [&>div]:bg-teal-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* Average Session Duration */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-yellow-100 text-yellow-600
        flex-shrink-0
        dark:border dark:border-yellow-500/20
        dark:text-yellow-400
        dark:bg-yellow-500/10
      ">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Avg. Session Duration</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">5m 20s</span>
                                    <span className="flex items-center text-sm text-rose-500">
                                        <TrendingDown className="mr-1 h-4 w-4" />1m
                                    </span>
                                </div>
                            </div>
                            <Progress value={65} className="mt-2 h-1.5 bg-muted [&>div]:bg-yellow-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* Conversion Rate */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-violet-100 text-violet-600
        flex-shrink-0
        dark:border dark:border-violet-500/20
        dark:text-violet-400
        dark:bg-violet-500/10
      ">
                            <ChartColumnDecreasing className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">Conversion Rate</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">3.6%</span>
                                    <span className="flex items-center text-sm text-rose-500">
                                        <TrendingDown className="mr-1 h-4 w-4" />2%
                                    </span>
                                </div>
                            </div>
                            <Progress value={36} className="mt-2 h-1.5 bg-muted [&>div]:bg-violet-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                    {/* New Signups */}
                    <div className="flex items-center gap-5">
                        <div className="
        flex h-10 w-10 items-center justify-center rounded-xl
        bg-orange-100 text-orange-600
        flex-shrink-0
        dark:border dark:border-orange-500/20
        dark:text-orange-400
        dark:bg-orange-500/10
      ">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div className="w-full">
                            <div className="flex items-center justify-between">
                                <span className="text-md text-muted-foreground">New Signups</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">1,245</span>
                                    <span className="flex items-center text-sm text-green-500">
                                        <TrendingUp className="mr-1 h-4 w-4" />+12%
                                    </span>
                                </div>
                            </div>
                            <Progress value={55} className="mt-2 h-1.5 bg-muted [&>div]:bg-orange-500 [&>div]:rounded-full" />
                        </div>
                    </div>

                </div>
            </CardContent>

        </Card>
    )
}
