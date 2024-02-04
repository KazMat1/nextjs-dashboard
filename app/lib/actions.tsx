'use server';

import { z } from "zod";
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from "next/navigation";
import { INVOICE_INDEX_PATH } from "../consts/invoice";
import type { State } from "../type/form";

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    amount: z.coerce.number()
        .gt(0, {
            message: 'Please enter an amount greater than $0.' }
        ), // change string to number forcefully
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const transformAmountToCents = (amount: number) => amount * 100;

const CreateInvoice = FormSchema.omit({ id: true, date: true });
export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = transformAmountToCents(amount);
    const date = new Date().toISOString().split('T')[0];

    // Insert data into the database
    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        }
    }

    // Revalidate the cache for the invoices page and redirect the user
    revalidatePath(INVOICE_INDEX_PATH);
    redirect(INVOICE_INDEX_PATH);
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });
export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Update Invoice',
        };
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = transformAmountToCents(amount);
    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Update Invoice.',
        }
    }

    revalidatePath(INVOICE_INDEX_PATH);
    redirect(INVOICE_INDEX_PATH);
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath(INVOICE_INDEX_PATH);
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return {
            message: 'Database Error: Failed to Delete Invoice.',
        }
    }
}
