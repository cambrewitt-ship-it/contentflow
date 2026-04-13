import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';

const WorkflowStepSchema = z.object({
  step_order: z.number().int().positive(),
  party_id: z.string().uuid().optional().nullable(),
  label: z.string().min(1).max(200),
  // agency_user_step: true means this step is actioned from the dashboard, not the portal
  agency_step: z.boolean().optional().default(false),
});

const CreateTemplateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  post_type_tag: z.enum(['pr_event', 'social']).optional().nullable(),
  steps: z.array(WorkflowStepSchema).min(1),
});

const UpdateTemplateSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  post_type_tag: z.enum(['pr_event', 'social']).optional().nullable(),
  steps: z.array(WorkflowStepSchema).min(1).optional(),
});

// GET /api/workflow-templates?client_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const client_id = searchParams.get('client_id');

    if (!client_id) {
      return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: templates, error } = await supabase
      .from('workflow_templates')
      .select('id, name, post_type_tag, steps, created_at, updated_at')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching workflow templates:', error);
      return NextResponse.json({ error: 'Failed to fetch workflow templates' }, { status: 500 });
    }

    return NextResponse.json({ templates: templates ?? [] });
  } catch (error) {
    logger.error('Workflow templates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/workflow-templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { client_id, name, post_type_tag, steps } = parsed.data;

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    // Validate that all party_ids belong to this client
    const partyIds = steps
      .map(s => s.party_id)
      .filter((id): id is string => !!id);

    if (partyIds.length > 0) {
      const { data: parties, error: partyError } = await supabase
        .from('portal_parties')
        .select('id')
        .eq('client_id', client_id)
        .in('id', partyIds);

      if (partyError) {
        logger.error('Error validating party IDs:', partyError);
        return NextResponse.json({ error: 'Failed to validate parties' }, { status: 500 });
      }

      const validIds = new Set((parties ?? []).map(p => p.id));
      const invalidIds = partyIds.filter(id => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: 'One or more party_ids do not belong to this client' },
          { status: 400 }
        );
      }
    }

    const { data: template, error } = await supabase
      .from('workflow_templates')
      .insert({ client_id, name, post_type_tag: post_type_tag ?? null, steps })
      .select()
      .single();

    if (error) {
      logger.error('Error creating workflow template:', error);
      return NextResponse.json({ error: 'Failed to create workflow template' }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    logger.error('Workflow templates POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/workflow-templates
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = UpdateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id, client_id, ...updates } = parsed.data;

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: template, error } = await supabase
      .from('workflow_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', client_id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating workflow template:', error);
      return NextResponse.json({ error: 'Failed to update workflow template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    logger.error('Workflow templates PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/workflow-templates?id=xxx&client_id=xxx
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const client_id = searchParams.get('client_id');

    if (!id || !client_id) {
      return NextResponse.json({ error: 'id and client_id are required' }, { status: 400 });
    }

    const auth = await requireClientOwnership(request, client_id);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { error } = await supabase
      .from('workflow_templates')
      .delete()
      .eq('id', id)
      .eq('client_id', client_id);

    if (error) {
      logger.error('Error deleting workflow template:', error);
      return NextResponse.json({ error: 'Failed to delete workflow template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Workflow templates DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
