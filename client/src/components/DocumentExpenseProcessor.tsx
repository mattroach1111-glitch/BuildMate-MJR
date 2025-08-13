import { useState } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { EmailInboxInfo } from "./EmailInboxInfo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Mail, Inbox, Settings } from "lucide-react";

export function DocumentExpenseProcessor() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Processing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Document Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentUploader />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-green-600" />
                Email Inbox Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmailInboxInfo />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}