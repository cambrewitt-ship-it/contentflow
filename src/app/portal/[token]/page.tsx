"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { usePortal } from "../../../contexts/PortalContext";
import { Card } from "components/ui/card";
import { Button } from "components/ui/button";
import { Upload, CheckCircle, Calendar, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PortalPage() {
  const params = useParams();
  const token = params?.token as string;
  const { client } = usePortal();
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    scheduledThisWeek: 0,
    totalPosts: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch approval statistics
  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/portal/approvals?token=${encodeURIComponent(token)}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const allPosts = data.weeks.flatMap((week: any) => week.posts);
            const pendingApprovals = allPosts.filter((post: any) => 
              !post.approval_status || post.approval_status === 'pending'
            ).length;
            
            // Calculate posts scheduled this week
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            
            const scheduledThisWeek = allPosts.filter((post: any) => {
              const postDate = new Date(post.scheduled_date);
              return postDate >= startOfWeek && postDate <= endOfWeek;
            }).length;
            
            setStats({
              pendingApprovals,
              scheduledThisWeek,
              totalPosts: allPosts.length
            });
          }
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (!client) {
    return null; // Layout will handle loading/error states
  }

  const features = [
    {
      icon: Upload,
      title: "Upload Content",
      description: "Submit new content for social media",
      action: "Start Uploading",
      href: `/portal/${token}/upload`
    },
    {
      icon: CheckCircle,
      title: "Review Approvals",
      description: "Review and approve scheduled posts",
      action: "View Approvals",
      href: `/portal/${token}/approvals`
    },
    {
      icon: Calendar,
      title: "View Calendar",
      description: "See your upcoming content schedule",
      action: "View Calendar",
      href: `/portal/${token}/calendar`
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-card-foreground mb-2">
          Welcome back, {client.name}!
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your content and stay connected with your audience
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total posts</p>
              <p className="text-2xl font-bold text-card-foreground">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalPosts}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Awaiting approval</p>
              <p className="text-2xl font-bold text-card-foreground">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.pendingApprovals}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">This week</p>
              <p className="text-2xl font-bold text-card-foreground">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.scheduledThisWeek}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.title} href={feature.href}>
              <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer group">
                <div className="text-center">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {feature.description}
                  </p>
                  <Button className="w-full" variant="outline" asChild>
                    <span>
                      {feature.action}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </span>
                  </Button>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Activity</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No recent activity to display</p>
          <p className="text-sm text-muted-foreground mt-2">
            Start by uploading content or checking your approvals
          </p>
        </div>
      </Card>
    </div>
  );
}
