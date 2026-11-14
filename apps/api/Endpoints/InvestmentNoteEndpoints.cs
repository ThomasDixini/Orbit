using Orbit.Api.Application.Investments;
using Orbit.Api.Domain.Investments;

namespace Orbit.Api.Endpoints;

/// <summary>Body of <c>PUT /investment-notes/{noteId}</c>; the id comes from the route.</summary>
public sealed record SaveInvestmentNoteRequest(
    string InvestmentId, InvestmentNoteKind Kind, DateOnly Date, string Text)
{
    public SaveInvestmentNoteCommand ToCommand(string noteId) => new(noteId, InvestmentId, Kind, Date, Text);
}

public sealed record InvestmentNoteResponse(
    string Id, string InvestmentId, InvestmentNoteKind Kind, DateOnly Date, string Text)
{
    public static InvestmentNoteResponse From(InvestmentNote note) =>
        new(note.Id, note.InvestmentId, note.Kind, note.Date, note.Text);
}

/// <summary>HTTP routes for the notes the user wrote about investments.</summary>
public static class InvestmentNoteEndpoints
{
    /// <summary>
    /// Maps <c>GET /investment-notes</c> and <c>PUT</c>/<c>DELETE /investment-notes/{noteId}</c>.
    /// </summary>
    /// <example><code>app.MapInvestmentNoteEndpoints();</code></example>
    public static IEndpointRouteBuilder MapInvestmentNoteEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/investment-notes", ListAsync);
        routes.MapPut("/investment-notes/{noteId}", SaveAsync);
        routes.MapDelete("/investment-notes/{noteId}", DeleteAsync);
        return routes;
    }

    private static async Task<IResult> ListAsync(ListInvestmentNotes list, CancellationToken cancellationToken)
    {
        var notes = await list.ExecuteAsync(cancellationToken);
        return Results.Ok(notes.Select(InvestmentNoteResponse.From).ToList());
    }

    private static async Task<IResult> SaveAsync(
        string noteId, SaveInvestmentNoteRequest request, SaveInvestmentNote save, CancellationToken cancellationToken)
    {
        var saved = await save.ExecuteAsync(request.ToCommand(noteId), cancellationToken);
        return Results.Ok(InvestmentNoteResponse.From(saved));
    }

    private static async Task<IResult> DeleteAsync(
        string noteId, DeleteInvestmentNote delete, CancellationToken cancellationToken)
    {
        await delete.ExecuteAsync(noteId, cancellationToken);
        return Results.NoContent();
    }
}
