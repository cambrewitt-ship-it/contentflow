import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Terms and Conditions</CardTitle>
            <p className="text-sm text-muted-foreground mt-2"><strong>Last Updated:</strong> 13 October 2025</p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">1. Agreement to Terms</h2>
              <p>
                By accessing or using Content Manager (&quot;the Service&quot;), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you may not use the Service.
              </p>
              <p>
                The Service is operated by OneOneThree Digital (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), based in New Zealand.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">2. Description of Service</h2>
              <p>
                Content Manager is a social media management platform that allows users to create, schedule, and publish content to various social media platforms. The Service operates on a Software-as-a-Service (SaaS) model with multiple subscription tiers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">3. Eligibility and Account Registration</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">3.1 Account Creation</h3>
              <p>To use the Service, you must:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Provide accurate and complete information (name and email address)</li>
                <li>Maintain the security of your account credentials</li>
                <li>Be responsible for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized access or security breach</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">3.2 Account Security</h3>
              <p>
                You are solely responsible for maintaining the confidentiality of your account login information. You agree to notify us immediately if you become aware of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">4. Subscription Plans and Pricing</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">4.1 Pricing Tiers</h3>
              <p>The Service offers the following subscription plans:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li><strong>Free Tier:</strong> Limited features with usage restrictions or trial period</li>
                <li><strong>In-House Plan:</strong> $35 NZD per month</li>
                <li><strong>Freelancer Plan:</strong> $79 NZD per month</li>
                <li><strong>Agency Plan:</strong> $199 NZD per month</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">4.2 Payment Terms</h3>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>All prices are in New Zealand Dollars (NZD) and exclude GST where applicable</li>
                <li>Payment is processed through Stripe, a third-party payment processor</li>
                <li>Subscriptions are billed on a recurring monthly basis</li>
                <li>You authorize us to charge your payment method for all fees incurred</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">4.3 Free Tier</h3>
              <p>
                The Free Tier may include usage limitations or time-based trial periods. We reserve the right to modify the features and limitations of the Free Tier at any time.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">4.4 Price Changes</h3>
              <p>
                We reserve the right to modify our pricing at any time. We will provide at least 30 days&apos; notice of any price increases. Continued use of the Service after a price change constitutes acceptance of the new pricing.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">5. Refunds and Cancellations</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">5.1 Cancellation</h3>
              <p>
                You may cancel your subscription at any time through your profile settings. Cancellation will take effect at the end of your current billing period.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">5.2 Refund Policy</h3>
              <p>
                All sales are final. Refunds will only be considered in cases of accidental subscription or resubscription where you contact us within 48 hours of the charge. We will evaluate refund requests on a case-by-case basis at our sole discretion. All refund decisions are final.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">5.3 Account Deletion</h3>
              <p>
                You may delete your account at any time through the profile settings page. Upon deletion, your data will be removed in accordance with our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">6. User Content and Intellectual Property</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">6.1 Your Content</h3>
              <p>
                You retain all rights to the content you create, upload, or post through the Service (&quot;User Content&quot;). By using the Service, you grant us a limited, non-exclusive, royalty-free license to store, display, and transmit your User Content solely for the purpose of providing the Service.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">6.2 Content Responsibility</h3>
              <p>You are solely responsible for your User Content and the consequences of posting it to social media platforms. You represent and warrant that:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>You own or have the necessary rights to use and share your User Content</li>
                <li>Your User Content does not violate any third-party rights</li>
                <li>Your User Content complies with these Terms and all applicable laws</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">6.3 Our Intellectual Property</h3>
              <p>
                The Service, including its design, features, functionality, and all content provided by us, is owned by OneOneThree Digital and is protected by copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">7. Third-Party Services</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">7.1 Social Media Platforms</h3>
              <p>
                The Service connects to third-party social media platforms through the LATE API. Your use of these platforms is subject to their respective terms of service and privacy policies. We are not responsible for the actions, policies, or content of third-party platforms.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">7.2 Payment Processing</h3>
              <p>
                Payments are processed by Stripe. Your payment information is subject to Stripe&apos;s privacy policy and terms of service.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">7.3 Analytics</h3>
              <p>
                We may use Google Analytics or similar third-party analytics services to improve the Service. These services may collect information about your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">8. Prohibited Uses</h2>
              <p>You agree not to use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Transmit malicious code, viruses, or harmful materials</li>
                <li>Attempt to gain unauthorized access to the Service or related systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any fraudulent or unlawful purpose</li>
                <li>Impersonate any person or entity</li>
                <li>Spam, harass, or abuse other users or third parties</li>
                <li>Share your account credentials with others</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">9. Security and Data Protection</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">9.1 Our Security Measures</h3>
              <p>
                We implement reasonable security measures to protect the Service and your data. However, we cannot guarantee absolute security.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">9.2 Your Responsibility</h3>
              <p>You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Maintaining the security of your account credentials</li>
                <li>Securing access to your social media accounts</li>
                <li>Using strong passwords and security practices</li>
                <li>Monitoring your account for unauthorized activity</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">9.3 Social Media Account Security</h3>
              <p>By connecting your social media accounts to the Service, you acknowledge that:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>You are granting the Service access to post and manage content on your behalf</li>
                <li>You should regularly review your connected accounts and permissions</li>
                <li>You can revoke access at any time through your social media platform settings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">10. Disclaimers and Limitations of Liability</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">10.1 Service Provided &quot;AS IS&quot;</h3>
              <p className="uppercase">
                THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">10.2 No Warranty of Security</h3>
              <p className="uppercase">
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DO NOT GUARANTEE THAT THE SERVICE WILL BE FREE FROM VIRUSES, MALWARE, OR OTHER HARMFUL COMPONENTS.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">10.3 Limitation of Liability</h3>
              <p className="uppercase">
                TO THE MAXIMUM EXTENT PERMITTED BY NEW ZEALAND LAW, IN NO EVENT SHALL ONEONEONE DIGITAL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Loss of profits, data, or business opportunities</li>
                <li>Unauthorized access to or alteration of your transmissions or data</li>
                <li>Security breaches, hacking, or data theft</li>
                <li>Unauthorized posting or activity on your social media accounts</li>
                <li>Any damages arising from third-party services or platforms</li>
              </ul>
              <p className="uppercase">
                OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100 NZD, WHICHEVER IS GREATER.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">10.4 Security Incidents</h3>
              <p>
                In the event of a security breach or unauthorized access, we will make reasonable efforts to notify affected users. However, we are not liable for damages resulting from such incidents. You acknowledge that internet-based services carry inherent security risks.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">10.5 Third-Party Actions</h3>
              <p>
                We are not responsible for the actions of third-party services, including social media platforms, payment processors, or API providers. We are not liable for any loss or damage resulting from unauthorized access to or use of your accounts on third-party platforms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">11. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless OneOneThree Digital, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any way connected with:
              </p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Your use of the Service</li>
                <li>Your User Content</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any rights of another party</li>
                <li>Any security breach of your account due to your negligence</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">12. Termination</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">12.1 By You</h3>
              <p>
                You may terminate your account at any time by deleting it through the profile settings page or by contacting us.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">12.2 By Us</h3>
              <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Violation of these Terms</li>
                <li>Fraudulent, abusive, or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>Any other reason at our sole discretion</li>
              </ul>

              <h3 className="text-xl font-semibold mt-4 mb-3">12.3 Effect of Termination</h3>
              <p>Upon termination:</p>
              <ul className="list-disc pl-6 space-y-2 my-4">
                <li>Your right to use the Service will immediately cease</li>
                <li>You will remain liable for all charges incurred prior to termination</li>
                <li>We may delete your User Content and account data</li>
                <li>Sections of these Terms that by their nature should survive termination will survive</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">13. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material changes by email or through the Service. Your continued use of the Service after changes take effect constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">14. Privacy</h2>
              <p>
                Your use of the Service is also governed by our Privacy Policy, which describes how we collect, use, and protect your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">15. Governing Law and Dispute Resolution</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">15.1 Governing Law</h3>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of New Zealand, without regard to conflict of law principles.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">15.2 Jurisdiction</h3>
              <p>
                You agree to submit to the exclusive jurisdiction of the courts of New Zealand for the resolution of any disputes arising from these Terms or your use of the Service.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">15.3 Dispute Resolution</h3>
              <p>
                Before filing any legal action, you agree to first contact us to attempt to resolve the dispute informally.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">16. General Provisions</h2>
              
              <h3 className="text-xl font-semibold mt-4 mb-3">16.1 Entire Agreement</h3>
              <p>
                These Terms constitute the entire agreement between you and OneOneThree Digital regarding the Service.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">16.2 Severability</h3>
              <p>
                If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full effect.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">16.3 Waiver</h3>
              <p>
                Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any other provision.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">16.4 Assignment</h3>
              <p>
                You may not assign or transfer these Terms or your account without our prior written consent. We may assign these Terms at any time without notice.
              </p>

              <h3 className="text-xl font-semibold mt-4 mb-3">16.5 Force Majeure</h3>
              <p>
                We are not liable for any failure or delay in performance due to circumstances beyond our reasonable control, including acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, pandemics, strikes, or shortages of transportation, facilities, fuel, energy, labor, or materials.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mt-6 mb-4">17. Contact Information</h2>
              <p>For questions about these Terms, please contact us at:</p>
              <p className="mt-4">
                <strong>OneOneThree Digital</strong><br />
                Email: cam@oneonethree.co.nz
              </p>
            </section>

            <hr className="my-8 border-t border-border" />

            <p className="text-center font-semibold">
              <strong>By using Content Manager, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

