using JewelrySite.BL;
using JewelrySite.DAL;
using JewelrySite.DTO;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace JewelrySite.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	public class JewelryItemController : ControllerBase
	{

		private readonly JewelryItemService _service;

		public JewelryItemController(JewelryItemService service) { 
			_service = service;
		}

		[HttpGet]
		public async Task<ActionResult<List<JewelryItemCatalogDto>>> GetJewerlyItems()
		{
			List<JewelryItemCatalogDto> items = await _service.GetAllJewelryItems();
			return Ok(items);
		}

		[HttpGet("{id}")] 
		public async Task<ActionResult<JewelryItem>> GetJewerlyById(int id) 
		{
			JewelryItem j = await _service.GetJewelryItemById(id);
			if (j == null) {return NotFound();}
			return Ok(j);
		}

		[HttpPost]
		public async Task<ActionResult<JewelryItem>> AddJewerlyItem(JewelryItem j)
		{
			
			return await _service.AddJewelryItem(j) != null ? CreatedAtAction(nameof(AddJewerlyItem), j) : BadRequest();
		}

		[HttpPut]
		public async Task<ActionResult> UpdateJewerlyItem(int id, JewelryItem updatedJewerly)
		{
			if (await _service.UpdateJewelryItem(id, updatedJewerly) != null) { return  NoContent(); }
			return BadRequest();
		}

		[HttpDelete]
		public async Task<ActionResult> DeleteJewerlyItem(int id)
		{
			if (await _service.DeleteJewelryItem(id) != null) { return NoContent(); }
			return BadRequest();
		}
	}
}
