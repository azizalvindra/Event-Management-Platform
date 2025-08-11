import { ReactElement } from 'react'
import PromotionForm from '@/components/PromotionForm'
import { PromotionList } from '@/components/PromotionList'
import { supabase } from '@/lib/supabaseClient'

export interface Promotion {
  id: string
  event_id: string
  code: string
  discount: number
  type: 'percent' | 'nominal'
  start_date: string
  end_date: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

type Props = {
  params: Promise<{ id: string }>
}

export default async function PromotionsPage({ params }: Props): Promise<ReactElement> {
  const { id: eventId } = await params

  const { data: promotions, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-red-500">Error loading promotions: {error.message}</p>
  }

  return (
    <div className="p-6 bg-white rounded-md shadow">
      <h1 className="text-3xl font-bold mb-4">Manage Promotions</h1>

      <PromotionForm eventId={eventId} />
      <PromotionList promotions={promotions || []} />
    </div>
  )
}
