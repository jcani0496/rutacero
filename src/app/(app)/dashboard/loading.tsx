import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
               <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <Skeleton className="h-4 w-24" />
                 <Skeleton className="size-4" />
               </div>
               <Skeleton className="h-8 w-32 my-2" />
               <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Debts list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-24" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border p-4">
                  <div className="flex items-center gap-3">
                     <Skeleton className="size-10 rounded-xl" />
                     <div className="space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-2">
                           <Skeleton className="h-5 w-16" />
                           <Skeleton className="h-4 w-20" />
                        </div>
                     </div>
                  </div>
                  <div className="space-y-1 text-right">
                     <Skeleton className="h-5 w-24" />
                     <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
               <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
                  <Skeleton className="size-12 rounded-xl" />
                  <div className="flex-1 space-y-1">
                     <Skeleton className="h-5 w-40" />
                     <Skeleton className="h-4 w-56" />
                  </div>
                  <Skeleton className="size-5" />
               </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
