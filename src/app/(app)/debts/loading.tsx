import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function DebtsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="h-10 w-full sm:flex-1" />
        <Skeleton className="h-10 w-full sm:w-48" />
      </div>

      {/* Table Skeleton */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex justify-between border-b pb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center py-4 border-b last:border-0">
               <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <Skeleton className="h-4 w-32" />
               </div>
               <Skeleton className="h-6 w-24" />
               <Skeleton className="h-4 w-20" />
               <Skeleton className="h-4 w-24" />
               <Skeleton className="h-6 w-16" />
               <Skeleton className="h-4 w-20" />
               <div className="flex gap-1">
                 <Skeleton className="size-8 rounded-md" />
                 <Skeleton className="size-8 rounded-md" />
                 <Skeleton className="size-8 rounded-md" />
               </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
